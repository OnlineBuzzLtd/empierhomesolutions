import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { crmDemoCookieName, isCrmDemoMutationBlocked } from "@/modules/crm/lib/demo";
import { getCrmEnv } from "@/modules/crm/lib/env";

export async function updateCrmSession(request: NextRequest) {
  const env = getCrmEnv();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-crm-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-crm-next", nextPath);

  if (!env.enabled || !env.url || !env.publishableKey) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = /^\/(dashboard|leads|customers|jobs|calendar|quotes|invoices|staff|reports|settings)(\/.*)?$/.test(pathname);
  const demoCookie = request.cookies.get(crmDemoCookieName)?.value;
  const isDemoActive = Boolean(demoCookie);

  if (pathname === "/login" && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.cookies.set("crm_next", nextPath, {
      path: "/",
      maxAge: 60 * 10,
      sameSite: "lax",
    });
    return redirectResponse;
  }

  if (isCrmDemoMutationBlocked(pathname, request.method, isDemoActive)) {
    return NextResponse.json({ error: "Demo mode is read-only." }, { status: 403 });
  }

  return response;
}
