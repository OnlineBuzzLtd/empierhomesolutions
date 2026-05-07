import { NextResponse } from "next/server";
import { z } from "zod";
import {
  closeCustomerJourneysWebchatSession,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { resolveLandingPageTenantId } from "@/modules/forms/api/landing-tenant";
import { validateRequestOrigin } from "@/lib/origin";

const PUBLIC_WEBCHAT_SOURCE = "empire_lp";

const closeRequestSchema = z.object({
  conversationId: z.string().uuid("Conversation ID is required."),
  closeReason: z
    .enum(["customer_ended", "operator_closed", "timeout", "resolved"])
    .optional()
    .default("customer_ended"),
});

export async function POST(request: Request) {
  const originCheck = validateRequestOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_origin", message: "Origin is not allowed." } },
      { status: 403 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = closeRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_failed", message: "Close payload is invalid." } },
      { status: 400 },
    );
  }

  try {
    const env = getCrmEnv();
    const admin = env.crmE2ePlatformFixturesEnabled
      ? ({} as never)
      : createCrmServiceRoleClient();

    const tenantId = env.crmE2ePlatformFixturesEnabled
      ? "11111111-1111-4111-8111-111111111111"
      : await resolveLandingPageTenantId(admin);

    const link = await getCustomerJourneysRuntimeLink(admin, tenantId);

    const result = await closeCustomerJourneysWebchatSession(link, {
      conversationId: parsed.data.conversationId,
      closeReason: parsed.data.closeReason,
      source: PUBLIC_WEBCHAT_SOURCE,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "public_webchat_close_failed",
        conversationId: parsed.data.conversationId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "close_failed",
          message: "Could not close the chat session.",
        },
      },
      { status: 502 },
    );
  }
}
