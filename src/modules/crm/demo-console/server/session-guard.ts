import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

// Common guard for every Demo Console API route. Returns either
// `{ ok: true, ... }` carrying the artefacts the handler needs, or
// `{ ok: false, response }` with a Next.js response the handler can
// return as-is.
//
// What the guard enforces:
//   - The caller is authenticated and has manager/admin role.
//   - The caller's active tenant has demo_console_enabled = true.
//   - If `requireActiveSession` is true, the tenant has an open
//     demo_sessions row (ended_at is null) — without this, trigger /
//     cleanup endpoints would have no scope to operate on.
//   - Cross-tenant safety: every artefact carries tenant_id from the
//     session, not from the request body.

export type DemoSessionRow = {
  id: string;
  tenant_id: string;
  started_at: string;
  ended_at: string | null;
  prospect_name: string;
  prospect_phone: string;
};

export type DemoGuardSuccess = {
  ok: true;
  tenantId: string;
  userId: string | null;
  admin: SupabaseClient;
  // Present when requireActiveSession=true. The active session is the
  // most recently started session with ended_at IS NULL.
  activeSession: DemoSessionRow | null;
};

export type DemoGuardFailure = {
  ok: false;
  response: NextResponse;
};

export type DemoGuardOptions = {
  requireActiveSession?: boolean;
};

export async function guardDemoApi(
  options: DemoGuardOptions = {},
): Promise<DemoGuardSuccess | DemoGuardFailure> {
  const session = await requireCrmUser();

  if (!session.settings?.demo_console_enabled) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Demo Console is not enabled for this tenant." }, { status: 404 }),
    };
  }

  if (!userCanManageSettings(session.profile?.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Insufficient role." }, { status: 403 }),
    };
  }

  const tenantId = session.tenant?.id ?? null;
  if (!tenantId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No active tenant." }, { status: 400 }),
    };
  }

  const admin = createCrmServiceRoleClient();
  let activeSession: DemoSessionRow | null = null;

  if (options.requireActiveSession) {
    const { data, error } = await admin
      .schema("crm")
      .from("demo_sessions")
      .select("id, tenant_id, started_at, ended_at, prospect_name, prospect_phone")
      .eq("tenant_id", tenantId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<DemoSessionRow>();

    if (error) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Session lookup failed." }, { status: 500 }),
      };
    }

    if (!data) {
      return {
        ok: false,
        response: NextResponse.json({ error: "No active demo session. Capture consent first." }, { status: 409 }),
      };
    }
    activeSession = data;
  }

  return {
    ok: true,
    tenantId,
    userId: session.user?.id ?? null,
    admin,
    activeSession,
  };
}
