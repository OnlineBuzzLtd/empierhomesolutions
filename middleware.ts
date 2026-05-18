import { NextResponse, type NextRequest } from "next/server";
import { updateCrmSession } from "@/modules/crm/lib/supabase-middleware";
import { applySecurityHeaders, generateNonce } from "@/lib/security-headers";
import { resolveTenantFromHost } from "@/lib/tenant-host";

const CRM_PROTECTED_PATH_PATTERN =
  /^\/(login|signup|dashboard|leads|customers|jobs|calendar|ai-hub|quotes|invoices|staff|reports|settings|demo|api\/crm)(\/.*)?$/;

function shouldRunCrmSession(pathname: string): boolean {
  return CRM_PROTECTED_PATH_PATTERN.test(pathname);
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const pathname = request.nextUrl.pathname;

  // Tenant resolver (Phase 3.1 of the enterprise multi-tenant hardening
  // plan). We parse the host header here so every request arrives at the
  // route handler already knowing which tenant it belongs to. The actual
  // tenant row lookup is deferred to the server-side code path so
  // middleware stays edge-friendly.
  const tenantBinding = resolveTenantFromHost(request.headers.get("host"));

  // Forward the nonce + tenant hints to downstream handlers so RSC/layout
  // code can read them from headers() and decorate <Script nonce={...} />
  // or pick the correct tenant for data fetching.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  if (tenantBinding.slug) {
    requestHeaders.set("x-tenant-slug", tenantBinding.slug);
  }
  requestHeaders.set("x-tenant-host", tenantBinding.host);
  if (tenantBinding.isApex) {
    requestHeaders.set("x-tenant-apex", "1");
  }

  let response: NextResponse;
  if (shouldRunCrmSession(pathname)) {
    // CRM session-handling path. It re-builds the response internally so it
    // can attach refreshed auth cookies; after it returns we still need to
    // stamp security headers onto the final response.
    response = await updateCrmSession(request, { requestHeaders });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  return applySecurityHeaders(request, response, nonce);
}

export const config = {
  /**
   * Run middleware on every route except Next.js internals and static assets.
   * Security headers (HSTS, CSP, etc.) must apply to HTML documents on ALL
   * public pages, not just CRM-protected paths.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
