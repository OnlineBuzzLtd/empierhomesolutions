import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { getCrmSession } from "@/modules/crm/lib/auth";
import type { CrmRole } from "@/modules/crm/types";

export type DevRouteAuthGrant = {
  reason:
    | "fixtures_mode"
    | "local_dev_bypass"
    | "authenticated_user";
  userId: string | null;
  role: CrmRole | null;
  tenantId: string | null;
};

export type DevRouteAuthDenial = {
  response: NextResponse;
};

const DEV_ROUTE_ALLOWED_ROLES: ReadonlyArray<CrmRole> = ["management", "admin"];

function isEnabledByEnvFlag() {
  return process.env.DEV_TEST_UI_ENABLED === "1" || process.env.NODE_ENV !== "production";
}

function isLocalBypassAllowed() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_TEST_BYPASS_AUTH === "1"
  );
}

/**
 * Gates every /api/dev/* route with layered checks:
 *
 *   1. Env-flag gate (DEV_TEST_UI_ENABLED or non-production) — existing behaviour.
 *   2. Fixtures mode — allowed (E2E/tests use these routes without Supabase).
 *   3. DEV_TEST_BYPASS_AUTH=1 on non-production — local-dev convenience escape hatch.
 *   4. Otherwise — require an authenticated Supabase user whose role is in the
 *      allow-list (management | admin). This is the path used whenever the
 *      routes are reachable in a deployed environment.
 *
 * Returning `{ response }` means the caller should immediately return that
 * response. Returning a `DevRouteAuthGrant` means the request is authorised
 * and the grant metadata may be attached to downstream logs.
 */
export async function assertDevRouteAuthorized(): Promise<DevRouteAuthGrant | DevRouteAuthDenial> {
  if (!isEnabledByEnvFlag()) {
    return {
      response: NextResponse.json({ error: "Dev test UI is disabled." }, { status: 403 }),
    };
  }

  const env = getCrmEnv();
  if (env.crmE2ePlatformFixturesEnabled) {
    return { reason: "fixtures_mode", userId: null, role: null, tenantId: null };
  }

  if (isLocalBypassAllowed()) {
    return { reason: "local_dev_bypass", userId: null, role: null, tenantId: null };
  }

  const session = await getCrmSession();

  if (!session.configured) {
    return {
      response: NextResponse.json(
        { error: "Dev test UI is not configured for auth." },
        { status: 503 },
      ),
    };
  }

  if (!session.user || !session.membership) {
    return {
      response: NextResponse.json(
        { error: "Authentication required for dev test routes." },
        { status: 401 },
      ),
    };
  }

  const role = (session.profile?.role ?? session.membership.role) as CrmRole | undefined;
  if (!role || !DEV_ROUTE_ALLOWED_ROLES.includes(role)) {
    return {
      response: NextResponse.json(
        { error: "Your role is not allowed to use dev test routes." },
        { status: 403 },
      ),
    };
  }

  return {
    reason: "authenticated_user",
    userId: session.user.id,
    role,
    tenantId: session.tenant?.id ?? null,
  };
}

export function isDevRouteAuthGrant(
  result: DevRouteAuthGrant | DevRouteAuthDenial,
): result is DevRouteAuthGrant {
  return "reason" in result;
}
