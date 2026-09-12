import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCustomerJourneysWebchatSession,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { resolveLandingPageTenantId } from "@/modules/forms/api/landing-tenant";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { validateRequestOrigin } from "@/lib/origin";
import { getAbFlags } from "@/modules/lp/abFlags";
import { webchatPreflightSchema } from "@/modules/lp/webchat-preflight";

// Turnstile is intentionally NOT required on the chat. The chat has built-in
// friction (per-IP rate limit of 4 sessions/minute and 30 messages/5min)
// and the agent itself prompts for identity, so drive-by bot value is low.
// The lead form uses Turnstile because it's a one-shot submission.

const PUBLIC_WEBCHAT_SOURCE = "empire_lp";

const sessionRequestSchema = z.object({
  visitorId: z.string().trim().min(8, "Visitor ID is required."),
  openingMessage: z.string().trim().min(1, "Opening message is required.").max(2000),
  fullName: z.string().trim().max(120).optional(),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]).optional(),
  phone: z.string().trim().max(32).optional(),
  postcode: z.string().trim().max(16).optional(),
  pagePath: z.string().trim().max(2048).optional(),
  startNewConversation: z.boolean().optional(),
  attribution: z
    .object({
      utm_source: z.string().max(120).optional(),
      utm_medium: z.string().max(120).optional(),
      utm_campaign: z.string().max(120).optional(),
      utm_term: z.string().max(120).optional(),
      utm_content: z.string().max(120).optional(),
      gclid: z.string().max(200).optional(),
      msclkid: z.string().max(200).optional(),
      landing_url: z.string().max(2048).optional(),
    })
    .partial()
    .optional()
    .default({}),
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

  const decision = await consumeRateLimit(`public-webchat-session:${ip}`, {
    tokens: 4,
    window: "1 m",
    prefix: "rl:public-webchat-session",
  });
  if (!decision.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "rate_limited",
          message: "Too many chat requests — please call 01895 725 151 or try again in a minute.",
        },
      },
      { status: 429, headers: rateLimitHeaders(decision) },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = sessionRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_failed", message: "Webchat payload is invalid." } },
      { status: 400 },
    );
  }

  const preflight = getAbFlags().webchatPreflight === "on"
    ? webchatPreflightSchema.safeParse(parsed.data)
    : null;
  if (preflight && !preflight.success) {
    return NextResponse.json(
      { ok: false, error: { code: "contact_details_required", message: "Name, mobile number, email, and your question are required." } },
      { status: 400 },
    );
  }

  const fullName = preflight?.success ? preflight.data.fullName : parsed.data.fullName?.trim() || undefined;
  const email = preflight?.success ? preflight.data.email : parsed.data.email?.trim() || undefined;
  const phone = preflight?.success ? preflight.data.phone : parsed.data.phone?.trim() || undefined;
  const openingMessage = preflight?.success ? preflight.data.openingMessage : parsed.data.openingMessage;
  const startNewConversation = preflight?.success ? true : parsed.data.startNewConversation;

  try {
    const env = getCrmEnv();
    const admin = env.crmE2ePlatformFixturesEnabled
      ? ({} as never)
      : createCrmServiceRoleClient();

    const tenantId = env.crmE2ePlatformFixturesEnabled
      ? "11111111-1111-4111-8111-111111111111"
      : await resolveLandingPageTenantId(admin);

    const link = await getCustomerJourneysRuntimeLink(admin, tenantId);

    const session = await createCustomerJourneysWebchatSession(link, {
      identifierValue: parsed.data.visitorId,
      fullName,
      email,
      phoneNumber: phone,
      openingMessage,
      startNewConversation,
      source: PUBLIC_WEBCHAT_SOURCE,
    });

    console.info(
      JSON.stringify({
        event: "public_webchat_session_created",
        tenantId,
        hasFullName: Boolean(fullName),
        hasEmail: Boolean(email),
        hasPhone: Boolean(phone),
        hasPostcode: Boolean(parsed.data.postcode),
      }),
    );

    return NextResponse.json(
      { ok: true, session },
      { headers: rateLimitHeaders(decision) },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "public_webchat_session_failed",
        error: error instanceof Error ? error.name : "unknown_error",
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "session_open_failed",
          message: "Could not start the chat right now. Please try again in a moment.",
        },
      },
      { status: 502 },
    );
  }
}
