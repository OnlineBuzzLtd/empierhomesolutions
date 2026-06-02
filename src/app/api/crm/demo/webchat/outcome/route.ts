import { NextResponse } from "next/server";
import { z } from "zod";
import { guardDemoKillSwitchClear } from "@/modules/crm/demo-console/server/demo-kill-switch";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";
import { getDemoWebchatOutcome } from "@/modules/crm/demo-console/server/webchat-outcome";

const scenarioKeySchema = z.enum([
  "emergency_repair_booking",
  "boiler_install_survey",
  "fixed_price_service_quote",
]);

const bodySchema = z.object({
  scenarioKey: scenarioKeySchema,
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
      { error: parsed.error.issues[0]?.message ?? "Invalid demo outcome payload." },
      { status: 400 },
    );
  }

  const killSwitch = await guardDemoKillSwitchClear(guard.admin, guard.tenantId);
  if (!killSwitch.ok) return killSwitch.response;

  const outcome = await getDemoWebchatOutcome({
    supabase: guard.admin,
    tenantId: guard.tenantId,
    session: guard.activeSession,
    scenarioKey: parsed.data.scenarioKey,
  });

  return NextResponse.json({ ok: true, outcome });
}
