import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tenant } from "@/modules/crm/types";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { buildPlatformE2eInboxFixtures } from "@/modules/platform/lib/e2e-fixtures";
import { listPlatformConversationRecords, type PlatformConversationRecord } from "@/modules/platform/lib/repository";

export const customerJourneysDefaultVerticalKey = "plumbing";

type CustomerJourneysRuntimeLinkRow = {
  crm_tenant_id: string;
  customerjourneys_tenant_id: string | null;
  platform_api_base_url: string | null;
  auth_mode: "internal_service" | "admin_bearer";
  webchat_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  voice_enabled: boolean;
  display_sms_number: string | null;
  display_whatsapp_number: string | null;
  display_voice_number: string | null;
  last_readiness_check: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CustomerJourneysRuntimeLink = CustomerJourneysRuntimeLinkRow;

export type CustomerJourneysChannelStatus = {
  enabled: boolean;
  ready: boolean;
  displayNumber: string | null;
  deepLink: string | null;
  reason: string | null;
};

export type CustomerJourneysRuntimeSurface = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    verticalKey: string;
  } | null;
  runtimeMode: "platform_ai" | "legacy_fallback" | null;
  bookingResourceCount: number;
  issues: string[];
  channels: {
    webchat: CustomerJourneysChannelStatus;
    sms: CustomerJourneysChannelStatus;
    whatsapp: CustomerJourneysChannelStatus;
    voice: CustomerJourneysChannelStatus;
  };
};

export type ChannelTestRuntimeSnapshot = {
  link: CustomerJourneysRuntimeLink | null;
  runtime: CustomerJourneysRuntimeSurface | null;
  recentRecords: PlatformConversationRecord[];
  runtimeConfigured: boolean;
  usingFixtures: boolean;
};

export type CustomerJourneysProvisioningInput = {
  tenant: Pick<Tenant, "id" | "name" | "slug">;
  timezone?: string | null;
};

type FixtureWebchatMessage = {
  id: string;
  body: string;
  direction: "inbound" | "outbound" | "system";
  createdAt: string;
};

type FixtureCapturedSlots = {
  service: string | null;
  postcode: string | null;
  name: string | null;
  timePreference: string | null;
};

type FixtureWebchatSession = {
  conversationId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  leadId: string;
  customerId: string;
  jobId: string;
  bookingAppointmentId: string;
  bookingTitle: string;
  bookingStartsAt: string;
  bookingEndsAt: string;
  bookingState: {
    currentState: string;
  } | null;
  captured: FixtureCapturedSlots;
  messages: FixtureWebchatMessage[];
  record: PlatformConversationRecord;
};

const UK_POSTCODE_REGEX = /\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/i;

function extractPostcode(text: string): string | null {
  const match = text.match(UK_POSTCODE_REGEX);
  if (!match) {
    return null;
  }
  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
}

// Fuzzy service matcher tolerates common typos like "boilder" -> "boiler",
// "plummer" -> "plumber" by matching a short stem instead of requiring an
// exact word. Keeping this intentionally narrow so names/addresses don't get
// misidentified as services.
function extractService(text: string): string | null {
  const lowered = text.toLowerCase();
  const rules: Array<{ pattern: RegExp; key: string }> = [
    { pattern: /\bboi?l[dr]?e?r?\b/, key: "boiler" },
    { pattern: /\bplumb|plumm/, key: "plumbing" },
    { pattern: /\bheat(?:ing)?\b/, key: "heating" },
    { pattern: /\bradiator/, key: "radiator" },
    { pattern: /\b(?:gas\s*(?:leak|safety|check)|leak)\b/, key: "emergency-callout" },
    { pattern: /\bemergency\b/, key: "emergency-callout" },
    { pattern: /\belectric(?:ian|al)?\b/, key: "electrical" },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(lowered)) {
      return rule.key;
    }
  }
  return null;
}

function extractTimePreference(text: string): string | null {
  const lowered = text.toLowerCase();
  const patterns = [
    /\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?\b/,
    /\btoday\b|\btomorrow\b|\btonight\b|\bthis\s+week\b|\bnext\s+week\b/,
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/,
    /\b(?:morning|afternoon|evening)\b/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(lowered)) {
      return text.trim();
    }
  }
  return null;
}

function looksLikeBareAddress(text: string): boolean {
  if (extractPostcode(text)) {
    return false;
  }
  return /\d+\s+[a-z].{2,}\b(?:lane|road|street|st|rd|ln|ave|avenue|close|way|drive|dr)\b/i.test(text);
}

function isAffirmativeConfirmation(text: string): boolean {
  return /\b(?:yes|yep|yeah|sure|ok(?:ay)?|please|sounds good|book\s*it|confirm|go\s*ahead)\b/i.test(text);
}

const customerJourneysFixtureSessions = new Map<string, FixtureWebchatSession>();

function fixtureTimestamp(offsetMinutes = 0) {
  const base = new Date("2026-04-07T10:00:00.000Z");
  base.setUTCMinutes(base.getUTCMinutes() + offsetMinutes);
  return base.toISOString();
}

function createFixtureConversationRecord(input: {
  conversationId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  leadId: string;
  customerId: string;
  jobId: string;
  bookingAppointmentId: string;
  bookingTitle: string;
  bookingStartsAt: string;
  bookingEndsAt: string;
}): PlatformConversationRecord {
  return {
    link: {
      id: randomUUID(),
      workspace_id: "77777777-7777-4777-8777-777777777777",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      conversation_id: input.conversationId,
      customer_id: input.customerId,
      lead_id: input.leadId,
      job_id: input.jobId,
      callback_appointment_id: null,
      booking_appointment_id: input.bookingAppointmentId,
      latest_channel: "webchat",
      identity_phone: input.customerPhone,
      identity_email: input.customerEmail,
      metadata: {
        booking_slot_label: "Thu 10:00-11:00",
        message_summary: "Fixture webchat booking confirmed.",
      },
      latest_event_at: fixtureTimestamp(2),
      created_at: fixtureTimestamp(),
      updated_at: fixtureTimestamp(2),
    },
    customer: {
      id: input.customerId,
      full_name: input.customerName,
      phone: input.customerPhone,
      email: input.customerEmail,
      postcode: "UB8 1AA",
    },
    lead: {
      id: input.leadId,
      status: "booked",
      source: "ai_webchat",
      next_action_at: null,
      updated_at: fixtureTimestamp(2),
    },
    job: {
      id: input.jobId,
      title: "Boiler service visit",
      status: "booked",
      scheduled_date: "2026-04-10",
    },
    callbackAppointment: null,
    bookingAppointment: {
      id: input.bookingAppointmentId,
      type: "booking",
      title: input.bookingTitle,
      starts_at: input.bookingStartsAt,
      ends_at: input.bookingEndsAt,
      status: "scheduled",
    },
  };
}

function buildFixtureWebchatSessionResponse(session: FixtureWebchatSession) {
  return {
    conversation: {
      id: session.conversationId,
    },
    messages: session.messages,
    bookingState: session.bookingState,
    replyMessage: [...session.messages].reverse().find((message) => message.direction === "outbound") ?? null,
  };
}

function createFixtureWebchatSession(input: {
  identifierValue: string;
  fullName?: string;
  email?: string;
  openingMessage: string;
}) {
  const conversationId = randomUUID();
  const leadId = randomUUID();
  const customerId = randomUUID();
  const jobId = randomUUID();
  const bookingAppointmentId = randomUUID();
  const customerName = input.fullName?.trim() || "Webchat Test Customer";
  const customerEmail = input.email?.trim() || (input.identifierValue.includes("@") ? input.identifierValue : null);
  const customerPhone = null;
  const bookingStartsAt = "2026-04-10T10:00:00.000Z";
  const bookingEndsAt = "2026-04-10T11:00:00.000Z";
  const bookingTitle = "Booked visit: Thu 10:00-11:00";
  const providedName = input.fullName?.trim() ? input.fullName.trim() : null;
  const captured: FixtureCapturedSlots = {
    service: extractService(input.openingMessage),
    postcode: extractPostcode(input.openingMessage),
    name: providedName,
    timePreference: extractTimePreference(input.openingMessage),
  };
  const opening = composeFixtureReply(captured, input.openingMessage, { bookedAlready: false });
  const messages: FixtureWebchatMessage[] = [
    {
      id: randomUUID(),
      body: input.openingMessage,
      direction: "inbound",
      createdAt: fixtureTimestamp(),
    },
    {
      id: randomUUID(),
      body: opening.body,
      direction: "outbound",
      createdAt: fixtureTimestamp(1),
    },
  ];

  const session: FixtureWebchatSession = {
    conversationId,
    customerName,
    customerEmail,
    customerPhone,
    leadId,
    customerId,
    jobId,
    bookingAppointmentId,
    bookingTitle,
    bookingStartsAt,
    bookingEndsAt,
    bookingState: {
      currentState: opening.nextState,
    },
    captured,
    messages,
    record: createFixtureConversationRecord({
      conversationId,
      customerName,
      customerEmail,
      customerPhone,
      leadId,
      customerId,
      jobId,
      bookingAppointmentId,
      bookingTitle,
      bookingStartsAt,
      bookingEndsAt,
    }),
  };

  customerJourneysFixtureSessions.set(conversationId, session);
  return buildFixtureWebchatSessionResponse(session);
}

export type WebchatSessionCloseReason =
  | "customer_ended"
  | "operator_closed"
  | "timeout"
  | "resolved"
  | "test_harness";

export type WebchatSessionCloseResult = {
  conversationId: string;
  previousStatus: string;
  status: string;
  closeReason: WebchatSessionCloseReason;
  closedAt: string;
  alreadyClosed: boolean;
};

function closeFixtureWebchatSession(input: {
  conversationId: string;
  closeReason: WebchatSessionCloseReason;
}): WebchatSessionCloseResult {
  const session = customerJourneysFixtureSessions.get(input.conversationId);
  const now = new Date().toISOString();
  if (!session) {
    return {
      conversationId: input.conversationId,
      previousStatus: "unknown",
      status: "unknown",
      closeReason: input.closeReason,
      closedAt: now,
      alreadyClosed: true,
    };
  }

  const previousState = session.bookingState?.currentState ?? "active";
  const alreadyClosed = previousState === "resolved";
  session.bookingState = { currentState: "resolved" };

  return {
    conversationId: input.conversationId,
    previousStatus: alreadyClosed ? "resolved" : "active",
    status: "resolved",
    closeReason: input.closeReason,
    closedAt: now,
    alreadyClosed,
  };
}

function composeFixtureReply(
  captured: FixtureCapturedSlots,
  inboundText: string,
  options: { bookedAlready?: boolean } = {},
): { body: string; nextState: string; confirm: boolean } {
  // Never repeat or confirm a booking twice.
  if (options.bookedAlready) {
    return {
      body: "Your visit is already booked for Thursday 10:00-11:00. Anything else I can help with?",
      nextState: "confirmed",
      confirm: false,
    };
  }

  const hasService = Boolean(captured.service);
  const hasPostcode = Boolean(captured.postcode);
  const hasName = Boolean(captured.name);
  const hasTime = Boolean(captured.timePreference);

  const asksForAvailability = /\b(avail|availabil|avaiable|slot|when|book|next\s+option|what.?s\s+next)\b/i.test(
    inboundText,
  );
  const addressWithoutPostcode = looksLikeBareAddress(inboundText);

  // If the user volunteered just a street address (no postcode), acknowledge
  // but explicitly ask for the postcode rather than pretending we captured it.
  if (addressWithoutPostcode && !hasPostcode) {
    return {
      body: "Thanks for the address. I still need the UK postcode to check availability - could you share it? (e.g. IG1 3SW)",
      nextState: "capturing_identity",
      confirm: false,
    };
  }

  // If the user asks about availability but we don't yet have postcode or
  // service, refuse to invent slots and ask for the missing field.
  if (asksForAvailability && (!hasPostcode || !hasService)) {
    if (!hasService) {
      return {
        body: "I can check availability once I know what you need. Is this a boiler service, plumbing, or something else?",
        nextState: "capturing_identity",
        confirm: false,
      };
    }
    return {
      body: "I can check availability once I have the postcode. What postcode is the property in?",
      nextState: "capturing_identity",
      confirm: false,
    };
  }

  if (!hasService) {
    return {
      body: "Happy to help. What service do you need - boiler, plumbing, or something else?",
      nextState: "capturing_identity",
      confirm: false,
    };
  }

  if (!hasPostcode) {
    return {
      body: "I can help with that. What postcode is the property in?",
      nextState: "capturing_identity",
      confirm: false,
    };
  }

  if (!hasName) {
    return {
      body: "Thanks. Can I take your full name for the booking?",
      nextState: "capturing_identity",
      confirm: false,
    };
  }

  if (!hasTime) {
    return {
      body: "Great - I have Thursday 10:00-11:00 available. Would that work?",
      nextState: "capturing_time",
      confirm: false,
    };
  }

  // All four captured: confirm the booking.
  return {
    body: "Booked for Thursday 10:00-11:00. We have your service visit locked in.",
    nextState: "confirmed",
    confirm: true,
  };
}

function appendFixtureWebchatMessage(input: {
  conversationId: string;
  body: string;
}) {
  const session = customerJourneysFixtureSessions.get(input.conversationId);
  if (!session) {
    throw new Error("Fixture webchat session not found.");
  }

  const inboundMessage: FixtureWebchatMessage = {
    id: randomUUID(),
    body: input.body,
    direction: "inbound",
    createdAt: fixtureTimestamp(session.messages.length + 1),
  };
  session.messages.push(inboundMessage);

  const previouslyBooked = session.bookingState?.currentState === "confirmed";

  // Merge any newly captured fields from this turn. Only accept postcode
  // writes when the regex actually matches a UK postcode (so "178 wansted
  // lane" never becomes a postcode). Service / time accept typos via the
  // fuzzy matchers defined above.
  const newPostcode = extractPostcode(input.body);
  if (newPostcode && !session.captured.postcode) {
    session.captured.postcode = newPostcode;
  }
  const newService = extractService(input.body);
  if (newService && !session.captured.service) {
    session.captured.service = newService;
  }
  const newTime = extractTimePreference(input.body);
  if (newTime && !session.captured.timePreference) {
    session.captured.timePreference = newTime;
  }
  // A name is only accepted when the bot just asked for one. We infer that
  // by checking the last outbound message for a name prompt, and we reject
  // bare affirmatives / postcodes / addresses.
  if (!session.captured.name) {
    const lastOutbound = [...session.messages]
      .reverse()
      .find((m) => m.direction === "outbound");
    const askedForName = Boolean(
      lastOutbound && /\b(?:name|full\s*name)\b/i.test(lastOutbound.body),
    );
    const trimmed = input.body.trim();
    const looksLikeName =
      askedForName &&
      trimmed.length >= 2 &&
      trimmed.length <= 60 &&
      !extractPostcode(trimmed) &&
      !looksLikeBareAddress(trimmed) &&
      !isAffirmativeConfirmation(trimmed) &&
      /^[A-Za-z][A-Za-z'\-\s.]*$/.test(trimmed);
    if (looksLikeName) {
      session.captured.name = trimmed;
    }
  }
  // Treat an explicit "yes/confirm/ok" reply to a time proposal as capturing
  // the time slot, so the booking can close even without a user-typed day.
  if (!session.captured.timePreference && isAffirmativeConfirmation(input.body)) {
    const lastOutbound = [...session.messages]
      .reverse()
      .find((m) => m.direction === "outbound");
    if (lastOutbound && /\b\d{1,2}:\d{2}\b/.test(lastOutbound.body)) {
      session.captured.timePreference = "Thursday 10:00-11:00";
    }
  }

  const reply = composeFixtureReply(session.captured, input.body, {
    bookedAlready: previouslyBooked,
  });
  const replyMessage: FixtureWebchatMessage = {
    id: randomUUID(),
    body: reply.body,
    direction: "outbound",
    createdAt: fixtureTimestamp(session.messages.length + 1),
  };
  session.messages.push(replyMessage);

  session.bookingState = { currentState: reply.nextState };

  return {
    message: inboundMessage,
    replyMessage,
  };
}

function buildCustomerJourneysFixtureSnapshot() {
  const fixtures = buildPlatformE2eInboxFixtures();
  const crmTenantId = fixtures.overview.alias.tenant_id;

  const link: CustomerJourneysRuntimeLink = {
    crm_tenant_id: crmTenantId,
    customerjourneys_tenant_id: crmTenantId,
    platform_api_base_url: "https://runtime.example.com",
    auth_mode: "internal_service",
    webchat_enabled: true,
    sms_enabled: true,
    whatsapp_enabled: true,
    voice_enabled: true,
    display_sms_number: "+441895725151",
    display_whatsapp_number: "+441895725151",
    display_voice_number: "+441895725151",
    last_readiness_check: {
      synced_at: "2026-04-07T10:00:00.000Z",
      fixture: true,
    },
    created_at: "2026-04-07T08:00:00.000Z",
    updated_at: "2026-04-07T10:00:00.000Z",
  };

  const runtime: CustomerJourneysRuntimeSurface = {
    tenant: {
      id: crmTenantId,
      slug: "empire-home-solutions",
      name: "Empire Home Solutions Runtime",
      verticalKey: "plumbing",
    },
    runtimeMode: "platform_ai",
    bookingResourceCount: 2,
    issues: [],
    channels: {
      webchat: {
        enabled: true,
        ready: true,
        displayNumber: null,
        deepLink: null,
        reason: null,
      },
      sms: {
        enabled: true,
        ready: true,
        displayNumber: "+44 1895 725151",
        deepLink: null,
        reason: null,
      },
      whatsapp: {
        enabled: true,
        ready: true,
        displayNumber: "+44 1895 725151",
        deepLink: "https://wa.me/441895725151",
        reason: null,
      },
      voice: {
        enabled: true,
        ready: true,
        displayNumber: "+44 1895 725151",
        deepLink: null,
        reason: null,
      },
    },
  };

  return {
    link,
    runtime,
    recentRecords: [...customerJourneysFixtureSessions.values()].some((session) => session.bookingState?.currentState === "confirmed")
      ? [
          ...[...customerJourneysFixtureSessions.values()]
            .filter((session) => session.bookingState?.currentState === "confirmed")
            .map((session) => session.record),
          ...fixtures.conversationRecords,
        ]
      : fixtures.conversationRecords,
    runtimeConfigured: true,
    usingFixtures: true,
  } satisfies ChannelTestRuntimeSnapshot;
}

function normalizeBaseUrl(value: string | null | undefined) {
  return value?.trim().replace(/\/$/, "") ?? null;
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function buildWhatsAppDeepLink(number: string | null) {
  if (!number) {
    return null;
  }

  const normalized = number.replace(/[^\d+]/g, "");
  return normalized.length > 0 ? `https://wa.me/${normalized.replace(/^\+/, "")}` : null;
}

function getRuntimeBaseUrl(link: CustomerJourneysRuntimeLink | null) {
  return normalizeBaseUrl(link?.platform_api_base_url) ?? normalizeBaseUrl(getCrmEnv().customerJourneysPlatformApiBaseUrl);
}

export function isCustomerJourneysRuntimeConfigured() {
  const env = getCrmEnv();
  return Boolean(env.customerJourneysPlatformApiBaseUrl && env.customerJourneysInternalApiToken);
}

export function isCustomerJourneysProvisioningConfigured() {
  const env = getCrmEnv();
  return Boolean(env.customerJourneysPlatformApiBaseUrl && env.customerJourneysAdminApiToken);
}

export async function getCustomerJourneysRuntimeLink(supabase: SupabaseClient, tenantId: string) {
  if (getCrmEnv().crmE2ePlatformFixturesEnabled) {
    return buildCustomerJourneysFixtureSnapshot().link;
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("customerjourneys_runtime_links")
    .select("*")
    .eq("crm_tenant_id", tenantId)
    .maybeSingle<CustomerJourneysRuntimeLinkRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function upsertCustomerJourneysRuntimeLink(
  supabase: SupabaseClient,
  input: {
    crmTenantId: string;
    customerJourneysTenantId?: string | null;
    platformApiBaseUrl?: string | null;
    authMode?: CustomerJourneysRuntimeLink["auth_mode"];
    webchatEnabled?: boolean;
    smsEnabled?: boolean;
    whatsappEnabled?: boolean;
    voiceEnabled?: boolean;
    displaySmsNumber?: string | null;
    displayWhatsAppNumber?: string | null;
    displayVoiceNumber?: string | null;
    lastReadinessCheck?: Record<string, unknown>;
  },
) {
  const payload = {
    crm_tenant_id: input.crmTenantId,
    customerjourneys_tenant_id: input.customerJourneysTenantId ?? null,
    platform_api_base_url: normalizeBaseUrl(input.platformApiBaseUrl) ?? null,
    auth_mode: input.authMode ?? "internal_service",
    webchat_enabled: input.webchatEnabled ?? false,
    sms_enabled: input.smsEnabled ?? false,
    whatsapp_enabled: input.whatsappEnabled ?? false,
    voice_enabled: input.voiceEnabled ?? false,
    display_sms_number: input.displaySmsNumber ?? null,
    display_whatsapp_number: input.displayWhatsAppNumber ?? null,
    display_voice_number: input.displayVoiceNumber ?? null,
    last_readiness_check: input.lastReadinessCheck ?? {},
  };

  const { data, error } = await supabase
    .schema("crm")
    .from("customerjourneys_runtime_links")
    .upsert(payload, { onConflict: "crm_tenant_id" })
    .select("*")
    .single<CustomerJourneysRuntimeLinkRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function provisionCustomerJourneysTenant(input: CustomerJourneysProvisioningInput) {
  const env = getCrmEnv();
  const baseUrl = normalizeBaseUrl(env.customerJourneysPlatformApiBaseUrl);
  const adminToken = env.customerJourneysAdminApiToken;

  if (!baseUrl || !adminToken) {
    return {
      tenantId: null,
      warning: "CustomerJourneys admin provisioning is not configured.",
    };
  }

  const response = await fetch(`${baseUrl}/v1/admin/tenants`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      slug: input.tenant.slug,
      name: input.tenant.name,
      timezone: input.timezone?.trim() || "Europe/London",
      verticalKey: customerJourneysDefaultVerticalKey,
      adminRole: "tenant_admin",
      featureFlags: {
        managed_text_agent_sms: true,
        managed_text_agent_whatsapp: true,
        managed_text_agent_webchat: true,
      },
      bookingResources: [],
    }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as {
    tenant?: { id?: string };
  };

  if (!response.ok || !body.tenant?.id) {
    return {
      tenantId: null,
      warning: `CustomerJourneys tenant provisioning failed with ${response.status}.`,
    };
  }

  return {
    tenantId: body.tenant.id,
    warning: null,
  };
}

export async function ensureCustomerJourneysRuntimeLink(
  supabase: SupabaseClient,
  input: CustomerJourneysProvisioningInput,
) {
  const existing = await getCustomerJourneysRuntimeLink(supabase, input.tenant.id);
  if (existing?.customerjourneys_tenant_id) {
    return {
      link: existing,
      warning: null,
    };
  }

  const provisioned = await provisionCustomerJourneysTenant(input);
  const link = await upsertCustomerJourneysRuntimeLink(supabase, {
    crmTenantId: input.tenant.id,
    customerJourneysTenantId: provisioned.tenantId,
    platformApiBaseUrl: getCrmEnv().customerJourneysPlatformApiBaseUrl,
    authMode: "internal_service",
  });

  return {
    link,
    warning: provisioned.warning,
  };
}

export async function fetchCustomerJourneysRuntimeSurface(link: CustomerJourneysRuntimeLink) {
  const env = getCrmEnv();
  const baseUrl = getRuntimeBaseUrl(link);
  if (!baseUrl || !link.customerjourneys_tenant_id || !env.customerJourneysInternalApiToken) {
    return null;
  }

  const response = await fetch(
    `${baseUrl}/v1/internal/tenants/${link.customerjourneys_tenant_id}/test-surface`,
    {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-internal-service-token": env.customerJourneysInternalApiToken,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`CustomerJourneys runtime info request failed with ${response.status}.`);
  }

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const tenant = asRecord(body.tenant);
  const channels = asRecord(body.channels);
  const sms = asRecord(channels.sms);
  const whatsapp = asRecord(channels.whatsapp);
  const voice = asRecord(channels.voice);
  const webchat = asRecord(channels.webchat);
  const issues = Array.isArray(body.issues) ? body.issues.flatMap((value) => (typeof value === "string" ? [value] : [])) : [];

  return {
    tenant: asString(tenant.id)
      ? {
          id: String(tenant.id),
          slug: String(tenant.slug ?? ""),
          name: String(tenant.name ?? ""),
          verticalKey: String(tenant.verticalKey ?? "plumbing"),
        }
      : null,
    runtimeMode:
      body.runtimeMode === "platform_ai" || body.runtimeMode === "legacy_fallback"
        ? body.runtimeMode
        : null,
    bookingResourceCount: Number(body.bookingResourceCount ?? 0),
    issues,
    channels: {
      webchat: {
        enabled: asBoolean(webchat.enabled),
        ready: asBoolean(webchat.ready),
        displayNumber: asString(webchat.displayNumber),
        deepLink: null,
        reason: asString(webchat.reason),
      },
      sms: {
        enabled: asBoolean(sms.enabled),
        ready: asBoolean(sms.ready),
        displayNumber: asString(sms.displayNumber),
        deepLink: null,
        reason: asString(sms.reason),
      },
      whatsapp: {
        enabled: asBoolean(whatsapp.enabled),
        ready: asBoolean(whatsapp.ready),
        displayNumber: asString(whatsapp.displayNumber),
        deepLink: buildWhatsAppDeepLink(asString(whatsapp.displayNumber)),
        reason: asString(whatsapp.reason),
      },
      voice: {
        enabled: asBoolean(voice.enabled),
        ready: asBoolean(voice.ready),
        displayNumber: asString(voice.displayNumber),
        deepLink: null,
        reason: asString(voice.reason),
      },
    },
  } satisfies CustomerJourneysRuntimeSurface;
}

export async function syncCustomerJourneysRuntimeLink(
  supabase: SupabaseClient,
  link: CustomerJourneysRuntimeLink,
  runtime: CustomerJourneysRuntimeSurface,
) {
  return upsertCustomerJourneysRuntimeLink(supabase, {
    crmTenantId: link.crm_tenant_id,
    customerJourneysTenantId: link.customerjourneys_tenant_id,
    platformApiBaseUrl: getRuntimeBaseUrl(link),
    authMode: link.auth_mode,
    webchatEnabled: runtime.channels.webchat.ready,
    smsEnabled: runtime.channels.sms.ready,
    whatsappEnabled: runtime.channels.whatsapp.ready,
    voiceEnabled: runtime.channels.voice.ready,
    displaySmsNumber: runtime.channels.sms.displayNumber,
    displayWhatsAppNumber: runtime.channels.whatsapp.displayNumber,
    displayVoiceNumber: runtime.channels.voice.displayNumber,
    lastReadinessCheck: {
      synced_at: new Date().toISOString(),
      runtime_mode: runtime.runtimeMode,
      booking_resource_count: runtime.bookingResourceCount,
      issues: runtime.issues,
      channels: runtime.channels,
    },
  });
}

export async function loadChannelTestRuntimeSnapshot(
  supabase: SupabaseClient,
  tenantId: string,
) {
  const env = getCrmEnv();
  if (env.crmE2ePlatformFixturesEnabled) {
    return buildCustomerJourneysFixtureSnapshot();
  }

  const [link, recentRecords] = await Promise.all([
    getCustomerJourneysRuntimeLink(supabase, tenantId),
    listPlatformConversationRecords(supabase, tenantId, 8),
  ]);

  if (!link) {
    return {
      link: null,
      runtime: null,
      recentRecords,
      runtimeConfigured: isCustomerJourneysRuntimeConfigured(),
      usingFixtures: false,
    } satisfies ChannelTestRuntimeSnapshot;
  }

  const runtime = await fetchCustomerJourneysRuntimeSurface(link).catch(() => null);
  if (runtime) {
    await syncCustomerJourneysRuntimeLink(supabase, link, runtime).catch(() => undefined);
  }

  return {
    link,
    runtime,
    recentRecords,
    runtimeConfigured: isCustomerJourneysRuntimeConfigured(),
    usingFixtures: false,
  } satisfies ChannelTestRuntimeSnapshot;
}

async function postJson<T>(url: string, body: Record<string, unknown>, extraHeaders?: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `CustomerJourneys request failed with ${response.status}.`);
  }

  return payload;
}

function buildRuntimeHeaders(link: CustomerJourneysRuntimeLink) {
  const env = getCrmEnv();
  const headers: Record<string, string> = {};
  if (link.auth_mode === "internal_service" && env.customerJourneysInternalApiToken) {
    headers["x-internal-service-token"] = env.customerJourneysInternalApiToken;
  }
  return headers;
}

function requireRuntimeLink(link: CustomerJourneysRuntimeLink | null): asserts link is CustomerJourneysRuntimeLink {
  if (!link || !link.customerjourneys_tenant_id || !getRuntimeBaseUrl(link)) {
    throw new Error("CustomerJourneys runtime is not linked for this CRM tenant.");
  }
}

export async function createCustomerJourneysWebchatSession(
  link: CustomerJourneysRuntimeLink | null,
  input: {
    identifierValue: string;
    fullName?: string;
    email?: string;
    openingMessage: string;
    source?: string;
  },
) {
  if (getCrmEnv().crmE2ePlatformFixturesEnabled) {
    return createFixtureWebchatSession(input);
  }

  requireRuntimeLink(link);
  const baseUrl = getRuntimeBaseUrl(link)!;

  return postJson<Record<string, unknown>>(
    `${baseUrl}/v1/webchat/sessions`,
    {
      tenantId: link.customerjourneys_tenant_id,
      identifierValue: input.identifierValue,
      fullName: input.fullName,
      email: input.email,
      openingMessage: input.openingMessage,
      ...(input.source ? { source: input.source } : {}),
    },
    buildRuntimeHeaders(link),
  );
}

export async function appendCustomerJourneysWebchatMessage(
  link: CustomerJourneysRuntimeLink | null,
  input: {
    conversationId: string;
    body: string;
    metadata?: Record<string, unknown>;
    source?: string;
  },
) {
  if (getCrmEnv().crmE2ePlatformFixturesEnabled) {
    return appendFixtureWebchatMessage({
      conversationId: input.conversationId,
      body: input.body,
    });
  }

  requireRuntimeLink(link);
  const baseUrl = getRuntimeBaseUrl(link)!;

  return postJson<Record<string, unknown>>(
    `${baseUrl}/v1/webchat/messages`,
    {
      tenantId: link.customerjourneys_tenant_id,
      conversationId: input.conversationId,
      body: input.body,
      metadata: input.metadata ?? {},
      ...(input.source ? { source: input.source } : {}),
    },
    buildRuntimeHeaders(link),
  );
}

export async function closeCustomerJourneysWebchatSession(
  link: CustomerJourneysRuntimeLink | null,
  input: {
    conversationId: string;
    closeReason?: WebchatSessionCloseReason;
    source?: string;
  },
): Promise<WebchatSessionCloseResult> {
  const closeReason: WebchatSessionCloseReason = input.closeReason ?? "customer_ended";

  if (getCrmEnv().crmE2ePlatformFixturesEnabled) {
    return closeFixtureWebchatSession({
      conversationId: input.conversationId,
      closeReason,
    });
  }

  requireRuntimeLink(link);
  const baseUrl = getRuntimeBaseUrl(link)!;

  return postJson<WebchatSessionCloseResult>(
    `${baseUrl}/v1/webchat/sessions/${encodeURIComponent(input.conversationId)}/close`,
    {
      tenantId: link.customerjourneys_tenant_id,
      closeReason,
      ...(input.source ? { source: input.source } : {}),
    },
    buildRuntimeHeaders(link),
  );
}
