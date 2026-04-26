import { NextResponse } from "next/server";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import {
  calendarAdminAccessErrorStatus,
  resolveCalendarAdminAccessState,
} from "@/modules/crm/lib/calendar-admin";
import { getCustomerJourneysRuntimeLink } from "@/modules/crm/lib/customerjourneys";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const NO_CONTENT_STATUS_CODES = new Set([101, 204, 205, 304]);

const ALLOWED_PATTERNS: RegExp[] = [
  /^v1\/internal\/tenants\/[^/]+\/resources$/,
  /^v1\/internal\/tenants\/[^/]+\/calendar\/availability-snapshot$/,
  /^v1\/internal\/tenants\/[^/]+\/calendar\/schedule-snapshot$/,
  /^v1\/internal\/tenants\/[^/]+\/resources\/[^/]+\/working-hours$/,
  /^v1\/internal\/tenants\/[^/]+\/time-off$/,
  /^v1\/internal\/tenants\/[^/]+\/time-off\/[^/]+$/,
  /^v1\/internal\/tenants\/[^/]+\/holidays$/,
  /^v1\/internal\/tenants\/[^/]+\/holidays\/[^/]+$/,
  /^v1\/internal\/tenants\/[^/]+\/resources\/[^/]+\/ics-tokens$/,
  /^v1\/internal\/tenants\/[^/]+\/ics-tokens\/[^/]+$/,
];

async function handle(request: Request, context: RouteContext) {
  const session = await requireCrmUser();
  if (!session.configured || !session.tenant) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { path } = await context.params;
  const joinedPath = path.join("/");

  if (!ALLOWED_PATTERNS.some((pattern) => pattern.test(joinedPath))) {
    return NextResponse.json({ error: "Unsupported platform endpoint." }, { status: 404 });
  }

  const supabase = createCrmServiceRoleClient();
  const link = await getCustomerJourneysRuntimeLink(supabase, session.tenant.id);
  const access = resolveCalendarAdminAccessState(link);
  if (!access.ready) {
    return NextResponse.json(
      { error: access.message ?? "Calendar control plane is not configured." },
      { status: calendarAdminAccessErrorStatus(access.status) },
    );
  }

  const requestedTenantId = path[3];
  if (!requestedTenantId || requestedTenantId !== access.platformTenantId) {
    return NextResponse.json({ error: "Tenant mismatch." }, { status: 403 });
  }

  const url = new URL(`${access.baseUrl}/${joinedPath}`);
  const requestUrl = new URL(request.url);
  for (const [key, value] of requestUrl.searchParams.entries()) {
    url.searchParams.append(key, value);
  }

  const headers = new Headers();
  headers.set("x-internal-service-token", access.internalToken!);
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const body =
    request.method === "GET" || request.method === "HEAD" || request.method === "DELETE"
      ? undefined
      : await request.text();

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const responseBody = await response.text();
  const responseHeaders = new Headers();
  const upstreamContentType = response.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("content-type", upstreamContentType);
  }

  if (NO_CONTENT_STATUS_CODES.has(response.status)) {
    return new NextResponse(null, {
      status: response.status,
      headers: responseHeaders,
    });
  }

  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handle(request, context);
}
