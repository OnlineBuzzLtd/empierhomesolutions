import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCustomerJourneysRuntimeLink,
  postCustomerJourneysInboundTurn,
} from "@/modules/crm/lib/customerjourneys";
import { classifyOptOutKeyword, recordContactOptIn, recordContactOptOut } from "@/modules/crm/notifications/opt-outs";
import { getWorkspaceAlias, upsertPlatformConversationLink } from "@/modules/platform/lib/repository";

export type InboundTextChannel = "sms" | "whatsapp";
export type InboundLeadSource = "postmark_email" | "google_lead_ads" | "meta_lead_ads" | "manual_inbound";

export type ResolvedInboundTenant = {
  tenantId: string;
  source: "explicit_id" | "explicit_slug" | "customerjourneys_number" | "twilio_number" | "support_email";
};

type CustomerRow = {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
};

type LeadRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  source: string | null;
};

type ConversationLinkRow = {
  id: string;
  conversation_id: string;
  customer_id: string | null;
  lead_id: string | null;
  metadata: Record<string, unknown>;
};

function normalizePhone(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const stripped = value.replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
  return stripped.length > 0 ? stripped : null;
}

function normalizeNumberLookup(value: string | null | undefined) {
  return normalizePhone(value)?.replace(/^\+/, "") ?? null;
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.includes("@") ? normalized : null;
}

function normalizeName(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function toLeadSourceEnum(source: string) {
  const normalized = source.toLowerCase();
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("sms")) return "sms";
  if (normalized.includes("email") || normalized.includes("postmark")) return "email";
  if (normalized.includes("google")) return "google_lead";
  if (normalized.includes("meta") || normalized.includes("facebook")) return "meta_lead";
  if (normalized.includes("webchat")) return "webchat";
  if (normalized.includes("form") || normalized.includes("landing")) return "landing_form";
  return "other";
}

function extractTenantQuery(input: { tenantId?: string | null; tenantSlug?: string | null }) {
  return {
    tenantId: input.tenantId?.trim() || null,
    tenantSlug: input.tenantSlug?.trim() || null,
  };
}

export async function resolveInboundTenant(
  supabase: SupabaseClient,
  input: {
    tenantId?: string | null;
    tenantSlug?: string | null;
    to?: string | null;
    channel?: InboundTextChannel | "email" | null;
  },
): Promise<ResolvedInboundTenant | null> {
  const query = extractTenantQuery(input);
  if (query.tenantId) {
    const { data, error } = await supabase
      .schema("crm")
      .from("tenants")
      .select("id")
      .eq("id", query.tenantId)
      .maybeSingle<{ id: string }>();
    if (error) throw error;
    return data ? { tenantId: data.id, source: "explicit_id" } : null;
  }

  if (query.tenantSlug) {
    const { data, error } = await supabase
      .schema("crm")
      .from("tenants")
      .select("id")
      .eq("slug", query.tenantSlug)
      .maybeSingle<{ id: string }>();
    if (error) throw error;
    return data ? { tenantId: data.id, source: "explicit_slug" } : null;
  }

  const normalizedTo = normalizeNumberLookup(input.to);
  if (normalizedTo && (input.channel === "sms" || input.channel === "whatsapp")) {
    const { data: runtimeLinks, error: runtimeError } = await supabase
      .schema("crm")
      .from("customerjourneys_runtime_links")
      .select("crm_tenant_id, display_sms_number, display_whatsapp_number")
      .returns<Array<{ crm_tenant_id: string; display_sms_number: string | null; display_whatsapp_number: string | null }>>();
    if (runtimeError) throw runtimeError;
    const runtimeMatch = (runtimeLinks ?? []).find((link) => {
      const candidates = [link.display_sms_number, link.display_whatsapp_number].map(normalizeNumberLookup);
      return candidates.includes(normalizedTo);
    });
    if (runtimeMatch) {
      return { tenantId: runtimeMatch.crm_tenant_id, source: "customerjourneys_number" };
    }

    const { data: twilioRows, error: twilioError } = await supabase
      .schema("crm")
      .from("tenant_twilio_state")
      .select("tenant_id, voice_number_e164")
      .returns<Array<{ tenant_id: string; voice_number_e164: string | null }>>();
    if (twilioError) throw twilioError;
    const twilioMatch = (twilioRows ?? []).find((row) => normalizeNumberLookup(row.voice_number_e164) === normalizedTo);
    if (twilioMatch) {
      return { tenantId: twilioMatch.tenant_id, source: "twilio_number" };
    }
  }

  const emailTo = normalizeEmail(input.to);
  if (emailTo && input.channel === "email") {
    const { data, error } = await supabase
      .schema("crm")
      .from("tenant_branding")
      .select("tenant_id, support_email")
      .returns<Array<{ tenant_id: string; support_email: string | null }>>();
    if (error) throw error;
    const match = (data ?? []).find((row) => normalizeEmail(row.support_email) === emailTo);
    if (match) {
      return { tenantId: match.tenant_id, source: "support_email" };
    }
  }

  return null;
}

async function findCustomer(
  supabase: SupabaseClient,
  input: { tenantId: string; phone?: string | null; email?: string | null },
) {
  if (input.phone) {
    const { data, error } = await supabase
      .schema("crm")
      .from("customers")
      .select("id, tenant_id, full_name, phone, email")
      .eq("tenant_id", input.tenantId)
      .eq("phone", input.phone)
      .eq("archived", false)
      .maybeSingle<CustomerRow>();
    if (error) throw error;
    if (data) return data;
  }

  if (input.email) {
    const { data, error } = await supabase
      .schema("crm")
      .from("customers")
      .select("id, tenant_id, full_name, phone, email")
      .eq("tenant_id", input.tenantId)
      .eq("email", input.email)
      .eq("archived", false)
      .maybeSingle<CustomerRow>();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function createCustomer(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
    source: string;
    notes?: string | null;
    postcode?: string | null;
  },
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .insert({
      tenant_id: input.tenantId,
      full_name: input.fullName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      postcode: input.postcode ?? null,
      source: input.source,
      source_enum: toLeadSourceEnum(input.source),
      notes: input.notes ?? null,
    })
    .select("id, tenant_id, full_name, phone, email")
    .single<CustomerRow>();
  if (error) throw error;
  return data;
}

async function createLead(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    customerId: string;
    source: string;
    notes: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("leads")
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      source: input.source,
      source_enum: toLeadSourceEnum(input.source),
      status: "new",
      notes: input.notes,
      lead_attribution: input.metadata ?? {},
      next_action_at: new Date().toISOString(),
    })
    .select("id, tenant_id, customer_id, source")
    .single<LeadRow>();
  if (error) throw error;
  return data;
}

async function findExistingConversationLink(
  supabase: SupabaseClient,
  input: { tenantId: string; channel: string; phone?: string | null; email?: string | null },
) {
  const selector = supabase
    .schema("crm")
    .from("platform_conversation_links")
    .select("id, conversation_id, customer_id, lead_id, metadata")
    .eq("tenant_id", input.tenantId)
    .eq("latest_channel", input.channel)
    .order("updated_at", { ascending: false })
    .limit(1);

  const { data, error } = input.phone
    ? await selector.eq("identity_phone", input.phone).returns<ConversationLinkRow[]>()
    : input.email
      ? await selector.eq("identity_email", input.email).returns<ConversationLinkRow[]>()
      : { data: [], error: null };
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

async function upsertInboundConversationLink(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    conversationId?: string | null;
    customerId: string;
    leadId: string;
    channel: string;
    phone?: string | null;
    email?: string | null;
    metadata: Record<string, unknown>;
  },
) {
  const alias = await getWorkspaceAlias(supabase, input.tenantId);
  if (!alias) {
    return null;
  }

  const existing =
    input.conversationId
      ? null
      : await findExistingConversationLink(supabase, {
          tenantId: input.tenantId,
          channel: input.channel,
          phone: input.phone,
          email: input.email,
        });
  const conversationId = input.conversationId ?? existing?.conversation_id ?? randomUUID();
  return upsertPlatformConversationLink(supabase, alias, {
    conversationId,
    customerId: input.customerId,
    leadId: input.leadId,
    latestChannel: input.channel,
    identityPhone: input.phone ?? null,
    identityEmail: input.email ?? null,
    latestEventAt: new Date().toISOString(),
    metadata: input.metadata,
  });
}

export async function captureInboundLead(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    source: InboundLeadSource | string;
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
    message: string;
    postcode?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const fullName = normalizeName(input.fullName, phone ? `Customer ${phone}` : email ?? "Unknown customer");
  const existingCustomer = await findCustomer(supabase, { tenantId: input.tenantId, phone, email });
  const customer =
    existingCustomer ??
    (await createCustomer(supabase, {
      tenantId: input.tenantId,
      fullName,
      phone,
      email,
      source: input.source,
      notes: input.message,
      postcode: input.postcode ?? null,
    }));
  const lead = await createLead(supabase, {
    tenantId: input.tenantId,
    customerId: customer.id,
    source: input.source,
    notes: input.message,
    metadata: input.metadata,
  });
  return { customer, lead };
}

export async function handleInboundTextTurn(
  supabase: SupabaseClient,
  input: {
    tenantId?: string | null;
    tenantSlug?: string | null;
    channel: InboundTextChannel;
    from: string;
    to: string;
    body: string;
    providerMessageId?: string | null;
    provider?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const tenant = await resolveInboundTenant(supabase, {
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    to: input.to,
    channel: input.channel,
  });
  if (!tenant) {
    throw new Error("Unable to resolve tenant for inbound text.");
  }

  const keyword = classifyOptOutKeyword(input.body);
  const from = input.channel === "whatsapp" ? input.from.replace(/^whatsapp:/i, "") : input.from;
  if (keyword === "stop") {
    await recordContactOptOut(supabase, {
      tenantId: tenant.tenantId,
      contact: from,
      channel: input.channel,
      source: input.provider ?? "inbound_text",
    });
    return {
      tenant,
      action: "opted_out" as const,
      reply: "You have been opted out. Reply START to opt back in.",
    };
  }
  if (keyword === "start") {
    await recordContactOptIn(supabase, {
      tenantId: tenant.tenantId,
      contact: from,
      channel: input.channel,
    });
    return {
      tenant,
      action: "opted_in" as const,
      reply: "You are opted back in. How can we help?",
    };
  }

  const captured = await captureInboundLead(supabase, {
    tenantId: tenant.tenantId,
    source: input.channel === "whatsapp" ? "whatsapp_inbound" : "sms_inbound",
    phone: from,
    message: input.body,
    metadata: {
      provider: input.provider ?? "twilio",
      providerMessageId: input.providerMessageId ?? null,
      to: input.to,
      tenantResolution: tenant.source,
      ...(input.metadata ?? {}),
    },
  });
  const link = await upsertInboundConversationLink(supabase, {
    tenantId: tenant.tenantId,
    customerId: captured.customer.id,
    leadId: captured.lead.id,
    channel: input.channel,
    phone: from,
    metadata: {
      last_inbound_text: input.body,
      last_provider_message_id: input.providerMessageId ?? null,
      provider: input.provider ?? "twilio",
    },
  });

  const runtimeLink = await getCustomerJourneysRuntimeLink(supabase, tenant.tenantId).catch(() => null);
  const customerJourneys = await postCustomerJourneysInboundTurn(runtimeLink, {
    channel: input.channel,
    conversationId: link?.conversation_id ?? undefined,
    body: input.body,
    from,
    to: input.to,
    crmCustomerId: captured.customer.id,
    crmLeadId: captured.lead.id,
    providerMessageId: input.providerMessageId ?? null,
    metadata: input.metadata ?? {},
  }).catch((error) => ({
    accepted: false as const,
    error: error instanceof Error ? error.message : "CustomerJourneys inbound turn failed.",
  }));

  return {
    tenant,
    action: "captured" as const,
    customer: captured.customer,
    lead: captured.lead,
    conversationId: link?.conversation_id ?? null,
    customerJourneys,
  };
}

export async function handleInboundEmailLead(
  supabase: SupabaseClient,
  input: {
    tenantId?: string | null;
    tenantSlug?: string | null;
    fromEmail: string;
    fromName?: string | null;
    toEmail: string;
    subject?: string | null;
    body: string;
    providerMessageId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const tenant = await resolveInboundTenant(supabase, {
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    to: input.toEmail,
    channel: "email",
  });
  if (!tenant) {
    throw new Error("Unable to resolve tenant for inbound email.");
  }
  const message = [input.subject ? `Subject: ${input.subject}` : null, input.body].filter(Boolean).join("\n\n");
  const captured = await captureInboundLead(supabase, {
    tenantId: tenant.tenantId,
    source: "postmark_email",
    fullName: input.fromName ?? null,
    email: input.fromEmail,
    message,
    metadata: {
      provider: "postmark",
      providerMessageId: input.providerMessageId ?? null,
      to: input.toEmail,
      tenantResolution: tenant.source,
      ...(input.metadata ?? {}),
    },
  });
  const link = await upsertInboundConversationLink(supabase, {
    tenantId: tenant.tenantId,
    customerId: captured.customer.id,
    leadId: captured.lead.id,
    channel: "email",
    email: input.fromEmail,
    metadata: {
      last_inbound_subject: input.subject ?? null,
      last_inbound_text: input.body,
      last_provider_message_id: input.providerMessageId ?? null,
      provider: "postmark",
    },
  });
  const runtimeLink = await getCustomerJourneysRuntimeLink(supabase, tenant.tenantId).catch(() => null);
  const customerJourneys = await postCustomerJourneysInboundTurn(runtimeLink, {
    channel: "email",
    conversationId: link?.conversation_id ?? undefined,
    body: message,
    from: input.fromEmail,
    to: input.toEmail,
    crmCustomerId: captured.customer.id,
    crmLeadId: captured.lead.id,
    providerMessageId: input.providerMessageId ?? null,
    metadata: input.metadata ?? {},
  }).catch((error) => ({
    accepted: false as const,
    error: error instanceof Error ? error.message : "CustomerJourneys inbound turn failed.",
  }));

  return {
    tenant,
    action: "captured" as const,
    customer: captured.customer,
    lead: captured.lead,
    conversationId: link?.conversation_id ?? null,
    customerJourneys,
  };
}
