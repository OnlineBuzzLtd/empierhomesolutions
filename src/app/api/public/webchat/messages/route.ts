import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendCustomerJourneysWebchatMessage,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { resolveLandingPageTenantId } from "@/modules/forms/api/landing-tenant";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { validateRequestOrigin } from "@/lib/origin";

const PUBLIC_WEBCHAT_SOURCE = "empire_lp";

const messageRequestSchema = z.object({
  conversationId: z.string().uuid("Conversation ID is required."),
  body: z.string().trim().min(1, "Message cannot be empty.").max(2000),
});

function getClientIp(headerStore: Awaited<ReturnType<typeof headers>>): string {
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return headerStore.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const originCheck = validateRequestOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_origin", message: "Origin is not allowed." } },
      { status: 403 },
    );
  }

  const decision = await consumeRateLimit(`public-webchat-message:${ip}`, {
    tokens: 30,
    window: "5 m",
    prefix: "rl:public-webchat-message",
  });
  if (!decision.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "rate_limited",
          message: "You're sending messages a bit fast. Take a breath and try again.",
        },
      },
      { status: 429, headers: rateLimitHeaders(decision) },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = messageRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_failed", message: "Message payload is invalid." } },
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

    const session = await appendCustomerJourneysWebchatMessage(link, {
      conversationId: parsed.data.conversationId,
      body: parsed.data.body,
      source: PUBLIC_WEBCHAT_SOURCE,
    });

    return NextResponse.json(
      { ok: true, session },
      { headers: rateLimitHeaders(decision) },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "public_webchat_message_failed",
        ip,
        conversationId: parsed.data.conversationId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "message_send_failed",
          message: "Could not send your message. Please try again.",
        },
      },
      { status: 502 },
    );
  }
}
