import { NextResponse } from "next/server";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";
import { replayCapturedLeadFixture } from "@/modules/crm/demo-console/server/replay-fixture";
import { getWorkspaceAlias } from "@/modules/platform/lib/repository";

// Demo Console "Trigger Meta lead" endpoint (ticket E-3 / E-4).
// Mirror of /api/crm/demo/trigger/google with the meta-lead.json
// fixture. Kept as a separate handler (rather than ?channel=meta) so
// future channel-specific concerns (Meta-only fields, different
// validation, etc.) can diverge without rewriting the route.

export async function POST() {
  const guard = await guardDemoApi({ requireActiveSession: true });
  if (!guard.ok) return guard.response;

  if (!guard.activeSession) {
    return NextResponse.json({ error: "No active session." }, { status: 409 });
  }

  // Same workspace_id resolution as the Google trigger — see the
  // comment in /api/crm/demo/trigger/google/route.ts for rationale.
  const alias = await getWorkspaceAlias(guard.admin, guard.tenantId);
  if (!alias?.workspace_id) {
    return NextResponse.json(
      { error: "No workspace_alias for this tenant — cannot fire platform events." },
      { status: 409 },
    );
  }

  try {
    const { result } = await replayCapturedLeadFixture({
      channel: "meta",
      workspaceId: alias.workspace_id,
      session: guard.activeSession,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "Replay failed downstream.",
          status: result.status,
          detail: result.responseBody.slice(0, 500),
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      event_id: result.eventId,
      session_id: guard.activeSession.id,
    });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Replay error." },
      { status: 500 },
    );
  }
}
