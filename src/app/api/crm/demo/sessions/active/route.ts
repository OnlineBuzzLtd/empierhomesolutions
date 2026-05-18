import { NextResponse } from "next/server";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";

// Read the currently-active demo session for the operator's tenant, if
// any. The UI uses this on mount + after consent / end-session actions
// so client state stays in sync with what the DB believes is open
// (even across tabs and across the kill switch flip).
//
// Returns 200 with { active: false } when there's no open session.

export async function GET() {
  const guard = await guardDemoApi({ requireActiveSession: false });
  if (!guard.ok) return guard.response;

  const { admin, tenantId } = guard;

  const { data, error } = await admin
    .schema("crm")
    .from("demo_sessions")
    .select("id, started_at, prospect_name, prospect_phone")
    .eq("tenant_id", tenantId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      started_at: string;
      prospect_name: string;
      prospect_phone: string;
    }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    session_id: data.id,
    started_at: data.started_at,
    prospect_name: data.prospect_name,
    prospect_phone: data.prospect_phone,
  });
}
