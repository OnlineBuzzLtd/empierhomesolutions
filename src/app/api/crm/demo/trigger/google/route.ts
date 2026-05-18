import { NextResponse } from "next/server";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";
import { replayCapturedLeadFixture } from "@/modules/crm/demo-console/server/replay-fixture";

// Demo Console "Trigger Google lead" endpoint (ticket E-3 / E-4).
// Requires an active demo session. Replays the captured Google Lead Ads
// fixture (with the consented prospect's name/phone substituted in)
// against our own /api/platform/events. The synthetic-number guard
// runs there; cleanup picks up the resulting rows via is_test=true.

export async function POST() {
  const guard = await guardDemoApi({ requireActiveSession: true });
  if (!guard.ok) return guard.response;

  if (!guard.activeSession) {
    return NextResponse.json({ error: "No active session." }, { status: 409 });
  }

  try {
    const { result } = await replayCapturedLeadFixture({
      channel: "google",
      workspaceId: guard.tenantId,
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
