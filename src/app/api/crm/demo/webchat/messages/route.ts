import { NextResponse } from "next/server";
import { z } from "zod";
import { parseWebchatTurnResponse } from "@/modules/crm/demo-console/parse-webchat-session";
import { guardDemoKillSwitchClear } from "@/modules/crm/demo-console/server/demo-kill-switch";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";
import { tagDemoWebchatRows } from "@/modules/crm/demo-console/server/webchat-row-tagger";
import { getDemoWebchatScenario } from "@/modules/crm/demo-console/webchat-scenarios";
import {
  appendCustomerJourneysWebchatMessage,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";

const bodySchema = z.object({
  conversationId: z.string().uuid("Conversation ID is required."),
  body: z.string().trim().min(1).max(2000),
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
      { error: parsed.error.issues[0]?.message ?? "Invalid scripted webchat message payload." },
      { status: 400 },
    );
  }

  const killSwitch = await guardDemoKillSwitchClear(guard.admin, guard.tenantId);
  if (!killSwitch.ok) return killSwitch.response;

  try {
    const scenario = getDemoWebchatScenario(parsed.data.scenarioKey);
    const link = await getCustomerJourneysRuntimeLink(guard.admin, guard.tenantId);
    const session = await appendCustomerJourneysWebchatMessage(link, {
      conversationId: parsed.data.conversationId,
      body: parsed.data.body,
      source: "demo_console_webchat",
      metadata: {
        is_test: true,
        demo_session_id: guard.activeSession.id,
        demo_scenario_key: scenario.key,
      },
    });
    const transcript = parseWebchatTurnResponse({ ok: true, session });
    const tagging = await tagDemoWebchatRows({
      supabase: guard.admin,
      tenantId: guard.tenantId,
      session: guard.activeSession,
      scenarioKey: scenario.key,
      conversationId: parsed.data.conversationId,
    });

    return NextResponse.json({
      ok: true,
      session,
      transcript,
      tagging,
    });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Scripted webchat message failed." },
      { status: 502 },
    );
  }
}
