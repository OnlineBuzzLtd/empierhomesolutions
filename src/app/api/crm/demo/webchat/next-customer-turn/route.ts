import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDemoCustomerTurn } from "@/modules/crm/demo-console/server/demo-customer-agent";
import { guardDemoKillSwitchClear } from "@/modules/crm/demo-console/server/demo-kill-switch";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";
import {
  generateCustomerJourneysDemoCustomerTurn,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";

const scenarioKeySchema = z.enum([
  "emergency_repair_booking",
  "boiler_install_survey",
  "fixed_price_service_quote",
]);

const bodySchema = z.object({
  scenarioKey: scenarioKeySchema,
  turnIndex: z.number().int().min(0).max(20),
  transcript: z
    .array(
      z.object({
        id: z.string().optional(),
        direction: z.enum(["inbound", "outbound", "system"]),
        body: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(30),
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
      { error: parsed.error.issues[0]?.message ?? "Invalid demo customer payload." },
      { status: 400 },
    );
  }

  const killSwitch = await guardDemoKillSwitchClear(guard.admin, guard.tenantId);
  if (!killSwitch.ok) return killSwitch.response;

  const input = {
    scenarioKey: parsed.data.scenarioKey,
    prospectName: guard.activeSession.prospect_name,
    prospectPhone: guard.activeSession.prospect_phone,
    transcript: parsed.data.transcript.map((message, index) => ({
      id: message.id ?? `transcript-${index}`,
      body: message.body,
      direction: message.direction,
    })),
    turnIndex: parsed.data.turnIndex,
  };

  const turn = await generateDemoCustomerTurn(input, {
    providerGenerateTurn: async (turnInput) => {
      const link = await getCustomerJourneysRuntimeLink(guard.admin, guard.tenantId);
      return generateCustomerJourneysDemoCustomerTurn(link, turnInput);
    },
  });

  return NextResponse.json({ ok: true, turn });
}
