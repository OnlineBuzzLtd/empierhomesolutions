import { NextResponse } from "next/server";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";

// Active state for the demo console (session + kill switch).
//
// The UI calls this on /demo/run mount so client state reflects the
// server: a session created in another tab + a kill switch left on
// after a previous session both have to propagate to a fresh page
// load, otherwise the operator gets confused state.
//
// Returns 200 always (no "no session" 404). The kill switch can be
// set without an active session.

export async function GET() {
  const guard = await guardDemoApi({ requireActiveSession: false });
  if (!guard.ok) return guard.response;

  const { admin, tenantId } = guard;

  const [sessionResult, settingsResult] = await Promise.all([
    admin
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
      }>(),
    admin
      .schema("crm")
      .from("tenant_settings")
      .select("demo_kill_switch_at")
      .eq("tenant_id", tenantId)
      .maybeSingle<{ demo_kill_switch_at: string | null }>(),
  ]);

  if (sessionResult.error) {
    return NextResponse.json({ error: sessionResult.error.message }, { status: 500 });
  }
  if (settingsResult.error) {
    return NextResponse.json({ error: settingsResult.error.message }, { status: 500 });
  }

  const session = sessionResult.data;
  return NextResponse.json({
    active: Boolean(session),
    session_id: session?.id ?? null,
    started_at: session?.started_at ?? null,
    prospect_name: session?.prospect_name ?? null,
    prospect_phone: session?.prospect_phone ?? null,
    demo_kill_switch_at: settingsResult.data?.demo_kill_switch_at ?? null,
  });
}
