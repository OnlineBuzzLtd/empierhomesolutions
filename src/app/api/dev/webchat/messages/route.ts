import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendCustomerJourneysWebchatMessage,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

const TENANT_1_ID = "11111111-1111-4111-8111-111111111111";

const sendSchema = z.object({
  conversationId: z.string().trim().min(1, "conversationId is required."),
  body: z.string().trim().min(1, "Message body is required."),
});

function isLocalOrDevEnabled() {
  return process.env.DEV_TEST_UI_ENABLED === "1" || process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  if (!isLocalOrDevEnabled()) {
    return NextResponse.json({ error: "Dev test UI is disabled." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  try {
    const env = getCrmEnv();
    const supabase = env.crmE2ePlatformFixturesEnabled ? ({} as never) : createCrmServiceRoleClient();
    const link = await getCustomerJourneysRuntimeLink(supabase, TENANT_1_ID);

    const response = await appendCustomerJourneysWebchatMessage(link, {
      conversationId: parsed.data.conversationId,
      body: parsed.data.body,
    });

    return NextResponse.json({ session: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send webchat message.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
