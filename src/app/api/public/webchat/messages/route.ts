import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendCustomerJourneysWebchatMessage,
  fetchCustomerJourneysConversation,
  getCustomerJourneysRuntimeLink,
  summariseConversationForLead,
  type CustomerJourneysConversationDetail,
  type CustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { resolveLandingPageTenantId } from "@/modules/forms/api/landing-tenant";
import type { PlatformEventEnvelope, PlatformEventType } from "@/modules/platform/contracts";
import { processPlatformEvent } from "@/modules/platform/lib/processor";
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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().replace(/\s+/g, " ") : null;
}

function findStringDeep(value: unknown, keys: string[], depth = 0): string | null {
  if (depth > 6 || typeof value !== "object" || value === null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringDeep(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const found = cleanString(record[key]);
    if (found) return found;
  }
  for (const item of Object.values(record)) {
    const found = findStringDeep(item, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

function extractUkPhoneFromText(value: string | null) {
  if (!value) return null;
  const match = value.match(/(?:\+44\s?7\d{3}|07\d{3})[\s-]?\d{3}[\s-]?\d{3}/);
  return match?.[0]?.trim() ?? null;
}

function extractUkPostcodeFromText(value: string | null) {
  if (!value) return null;
  const match = value.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i);
  return match?.[0]?.toUpperCase() ?? null;
}

// A public webchat message is only treated as test traffic when the customer
// says so unambiguously. The previous rule was `/\btest\b/i` over the whole
// message, which flagged genuine customers writing things like "the boiler
// failed its test" or "I need a gas safety test" — those rows then got excluded
// from availability checks and swept up by test-data cleanup.
const EXPLICIT_TEST_MESSAGE =
  /^\s*(?:this\s+is\s+(?:a|just\s+a)\s+test|test\s+message|testing\s+the\s+(?:chat|bot|system)|ignore[\s,-]+test)\b/i;

export function isTestConversation(inboundText: string) {
  return EXPLICIT_TEST_MESSAGE.test(inboundText);
}

function eventTypeForWebchatOutcome(outcome: string | null, bookingState: string | null): PlatformEventType | null {
  if (bookingState === "booking_confirmed" || outcome === "booking_confirmed") return "BookingConfirmed";
  if (outcome === "handoff_required") return "EscalationRaised";
  if (outcome === "qualified" || outcome === "lead_qualified") return "ConversationQualified";
  return null;
}

async function processPublicWebchatOutcome(input: {
  supabase: ReturnType<typeof createCrmServiceRoleClient>;
  customerJourneysTenantId: string | null;
  conversationId: string;
  inboundBody: string;
  session: unknown;
  link: CustomerJourneysRuntimeLink | null;
}) {
  if (!input.customerJourneysTenantId) return;

  const session = asRecord(input.session);
  const message = asRecord(session.message);
  const replyMessage = asRecord(session.replyMessage);
  const replyMetadata = asRecord(replyMessage.metadata);
  const bookingState = asRecord(session.bookingState);
  const outcome = cleanString(replyMetadata.outcome);
  const currentState = cleanString(bookingState.currentState) ?? findStringDeep(replyMetadata, ["currentState", "current_state"]);
  const eventType = eventTypeForWebchatOutcome(outcome, currentState);
  if (!eventType) return;

  const inboundText = cleanString(message.body) ?? input.inboundBody;
  const responseText = cleanString(replyMessage.body);
  const occurredAt = cleanString(replyMessage.createdAt) ?? cleanString(message.createdAt) ?? new Date().toISOString();

  // `POST /v1/webchat/messages` returns only the two messages in this turn — it
  // carries neither the transcript nor the identity the agent collected earlier
  // in the conversation. Without this read, an escalated enquiry reaches the CRM
  // as a single line ("I want a time on Thursday") with no name or number, and
  // the office has no way to follow up. Best-effort: a runtime blip must not
  // cost us the enquiry, so on failure we fall back to the old single-turn
  // behaviour rather than throwing.
  let detail: CustomerJourneysConversationDetail | null = null;
  try {
    detail = await fetchCustomerJourneysConversation(input.link, input.conversationId);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "public_webchat_conversation_fetch_failed",
        conversationId: input.conversationId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  const customerPhone =
    detail?.identity.phoneNumber ??
    findStringDeep(input.session, ["phoneNumber", "phone_number", "customer_phone", "customerPhone"]) ??
    extractUkPhoneFromText(inboundText);
  const customerPostcode =
    detail?.identity.postcode ??
    findStringDeep(input.session, ["postcode", "customer_postcode", "servicePostcode"]) ??
    extractUkPostcodeFromText(inboundText);
  const customerEmail =
    detail?.identity.email ?? findStringDeep(input.session, ["email", "customer_email", "customerEmail", "identity_email"]);
  const customerName =
    detail?.identity.fullName ?? findStringDeep(input.session, ["fullName", "full_name", "customer_name", "customerName"]);
  const customerAddress = detail?.identity.address ?? null;
  const service =
    detail?.service.serviceName ??
    detail?.service.serviceKey ??
    findStringDeep(input.session, ["serviceName", "service_name", "serviceKey", "service_key", "title"]);

  const transcript = summariseConversationForLead(detail, inboundText);

  const envelope: PlatformEventEnvelope = {
    event_id: randomUUID(),
    event_type: eventType,
    event_version: 1,
    workspace_id: input.customerJourneysTenantId,
    occurred_at: occurredAt,
    source_system: "agentic_runtime",
    // Include the occurrence timestamp so a later escalation in the same
    // conversation is not silently deduped against the first one. Previously the
    // key was conversation+type alone, so only the first handoff was ever
    // recorded even when the customer escalated again with new information.
    idempotency_key: `public-webchat:${input.conversationId}:${eventType}:${occurredAt}`,
    correlation_id: input.conversationId,
    aggregate: {
      type: "conversation",
      id: input.conversationId,
    },
    payload: {
      channel: "webchat",
      source: PUBLIC_WEBCHAT_SOURCE,
      conversation_id: input.conversationId,
      customer_name: customerName,
      customer_full_name: customerName,
      customer_phone: customerPhone,
      identity_phone: customerPhone,
      customer_email: customerEmail,
      identity_email: customerEmail,
      customer_postcode: customerPostcode,
      postcode: customerPostcode,
      customer_address: customerAddress,
      service,
      issue: transcript,
      problem_description: transcript,
      message_summary: transcript,
      latest_customer_message: inboundText,
      response_text: responseText,
      reason: cleanString(replyMetadata.fallbackReason) ?? outcome ?? eventType,
      trigger: outcome ?? eventType,
      lead_score: eventType === "ConversationQualified" ? 80 : undefined,
      is_test: isTestConversation(inboundText),
      metadata: {
        public_webchat_source: PUBLIC_WEBCHAT_SOURCE,
        outcome,
        booking_state: currentState,
        transcript_message_count: detail?.messages.length ?? 0,
      },
    },
  };

  await processPlatformEvent(input.supabase, envelope);
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

    if (!env.crmE2ePlatformFixturesEnabled) {
      await processPublicWebchatOutcome({
        supabase: admin,
        customerJourneysTenantId: link?.customerjourneys_tenant_id ?? null,
        conversationId: parsed.data.conversationId,
        inboundBody: parsed.data.body,
        session,
        link,
      }).catch((error) => {
        console.warn(
          JSON.stringify({
            event: "public_webchat_outcome_bridge_failed",
            conversationId: parsed.data.conversationId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      });
    }

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
