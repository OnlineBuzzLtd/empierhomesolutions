import { NextResponse } from "next/server";
import { z } from "zod";
import { parseWebchatSessionResponse } from "@/modules/crm/demo-console/parse-webchat-session";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";
import { guardDemoKillSwitchClear } from "@/modules/crm/demo-console/server/demo-kill-switch";
import { tagDemoWebchatRows } from "@/modules/crm/demo-console/server/webchat-row-tagger";
import { getDemoWebchatScenario } from "@/modules/crm/demo-console/webchat-scenarios";
import {
  createCustomerJourneysWebchatSession,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";

const bodySchema = z.object({
  openingMessage: z.string().trim().min(1).max(2000),
  scenarioKey: z.enum(["emergency_repair_booking", "boiler_install_survey", "fixed_price_service_quote"]),
});

export async function POST(request: Request) {
  const guard = await guardDemoApi({ requireActiveSession: true });
  if (!guard.ok) return guard.response;
  if (!guard.activeSession) {
    return NextResponse.json({ error: "No active demo session." }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid scripted webchat session payload." },
      { status: 400 },
    );
  }

  const killSwitch = await guardDemoKillSwitchClear(guard.admin, guard.tenantId);
  if (!killSwitch.ok) return killSwitch.response;

  try {
    const scenario = getDemoWebchatScenario(parsed.data.scenarioKey);
    const link = await getCustomerJourneysRuntimeLink(guard.admin, guard.tenantId);
    const session = await createCustomerJourneysWebchatSession(link, {
      identifierValue: `demo:${guard.activeSession.id}:${scenario.key}`,
      fullName: guard.activeSession.prospect_name,
      openingMessage: parsed.data.openingMessage,
      source: "demo_console_webchat",
      metadata: {
        is_test: true,
        demo_session_id: guard.activeSession.id,
        demo_scenario_key: scenario.key,
      },
    });
    const transcript = parseWebchatSessionResponse({ ok: true, session });
    if (!transcript) {
      throw new Error("Webchat session response missing conversation id.");
    }
    const tagging = await tagDemoWebchatRows({
      supabase: guard.admin,
      tenantId: guard.tenantId,
      session: guard.activeSession,
      scenarioKey: scenario.key,
      conversationId: transcript.conversationId,
    });

    return NextResponse.json({
      ok: true,
      session,
      transcript,
      tagging,
    });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Scripted webchat session failed." },
      { status: 502 },
    );
  }
}
