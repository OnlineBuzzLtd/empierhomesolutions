import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tenant } from "@/modules/crm/types";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { buildPlatformE2eInboxFixtures } from "@/modules/platform/lib/e2e-fixtures";
import { listPlatformConversationRecords, type PlatformConversationRecord } from "@/modules/platform/lib/repository";

export const customerJourneysDefaultVerticalKey = "plumbing";
export const empireCustomerJourneysRuntimeTenantId = "75d76e43-4e5e-4568-8ff2-e2594c9818f9";

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
  messages: FixtureWebchatMessage[];
  record: PlatformConversationRecord;
};

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
  const messages: FixtureWebchatMessage[] = [
    {
      id: randomUUID(),
      body: input.openingMessage,
      direction: "inbound",
      createdAt: fixtureTimestamp(),
    },
    {
      id: randomUUID(),
      body: "I can help with that. What postcode is the property in?",
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
      currentState: "capturing_identity",
    },
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

  const looksBookable = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i.test(input.body) || /\b(yes|book|confirm)\b/i.test(input.body);
  const replyMessage: FixtureWebchatMessage = {
    id: randomUUID(),
    body: looksBookable
      ? "Booked for Thursday 10:00-11:00. We have your service visit locked in."
      : "Thanks. I can keep going once you share the postcode or confirm the slot.",
    direction: "outbound",
    createdAt: fixtureTimestamp(session.messages.length + 1),
  };
  session.messages.push(replyMessage);

  if (looksBookable) {
    session.bookingState = {
      currentState: "confirmed",
    };
  }

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

  if (input.tenant.id === "11111111-1111-4111-8111-111111111111") {
    const link = await upsertCustomerJourneysRuntimeLink(supabase, {
      crmTenantId: input.tenant.id,
      customerJourneysTenantId: empireCustomerJourneysRuntimeTenantId,
      platformApiBaseUrl: getCrmEnv().customerJourneysPlatformApiBaseUrl,
      authMode: "internal_service",
    });
    return {
      link,
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
    },
    buildRuntimeHeaders(link),
  );
}
