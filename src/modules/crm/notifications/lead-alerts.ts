import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTenantSms } from "@/modules/crm/lib/sms-sender";
import type { PlatformEventEnvelope } from "@/modules/platform/contracts";
import { getPlatformConversationLink, type WorkspaceAlias } from "@/modules/platform/lib/repository";

const ALERT_TEMPLATE_KEY = "internal_lead_alert_sms";
const DEFAULT_CRM_LEADS_URL = "https://empire-home-solutions.vercel.app/leads";

type SmsSender = typeof sendTenantSms;

type SendAlertResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: "recipient_not_configured" | "duplicate" | "not_applicable" }
  | { ok: false; warning: string };

type LeadAlertDetails = {
  tenantId: string;
  sourceLabel: string;
  idempotencyKey: string;
  name?: string | null;
  phone?: string | null;
  postcode?: string | null;
  service?: string | null;
  issue?: string | null;
  bookingTime?: string | null;
  leadId?: string | null;
  customerId?: string | null;
  conversationId?: string | null;
  submissionCount?: number | null;
};

export type WebsiteLeadAlertInput = {
  tenantId: string;
  leadId: string;
  customerId: string | null;
  name: string;
  phone: string;
  postcode: string;
  service?: string | null;
  issue?: string | null;
  leadType?: string | null;
  location?: string | null;
  submissionCount: number;
};

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().replace(/\s+/g, " ") : null;
}

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

export function normalizeUkSmsRecipient(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (raw.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("00") && digits.length > 2) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith("44")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+44${digits.slice(1)}`;
  }
  if (digits.startsWith("7") && digits.length === 10) {
    return `+44${digits}`;
  }

  return `+${digits}`;
}

function alertRecipient() {
  return normalizeUkSmsRecipient(process.env.CRM_LEAD_ALERT_SMS_TO);
}

function crmLeadsUrl() {
  const baseUrl = cleanString(process.env.NEXT_PUBLIC_SITE_URL);
  if (!baseUrl) return DEFAULT_CRM_LEADS_URL;

  try {
    return new URL("/leads", baseUrl).toString();
  } catch {
    return DEFAULT_CRM_LEADS_URL;
  }
}

export function buildLeadAlertSmsBody(details: Omit<LeadAlertDetails, "tenantId" | "idempotencyKey">) {
  const lines = [`Empire ${details.sourceLabel}`];

  if (details.name) lines.push(`Name: ${details.name}`);
  if (details.phone) lines.push(`Phone: ${details.phone}`);
  if (details.postcode) lines.push(`Postcode: ${details.postcode}`);
  if (details.service) lines.push(`Service: ${details.service}`);
  if (details.bookingTime) lines.push(`Booking: ${details.bookingTime}`);
  if (details.issue) lines.push(`Issue: ${truncate(details.issue, 120)}`);
  if (details.submissionCount && details.submissionCount > 1) {
    lines.push(`Repeat submission: #${details.submissionCount}`);
  }
  if (details.leadId) lines.push(`Lead: ${details.leadId}`);
  if (!details.leadId && details.conversationId) lines.push(`Conversation: ${details.conversationId}`);
  lines.push(`CRM: ${crmLeadsUrl()}`);

  return lines.join("\n");
}

async function reserveAlertDelivery(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    recipient: string;
    body: string;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
  },
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .schema("crm")
    .from("scheduled_notifications")
    .insert({
      tenant_id: input.tenantId,
      recipient: input.recipient,
      channel: "sms",
      template_key: ALERT_TEMPLATE_KEY,
      payload: { body: input.body },
      status: "pending",
      attempts: 0,
      max_attempts: 1,
      dispatch_at: now,
      next_attempt_at: null,
      sent_at: null,
      cancelled_at: null,
      last_error: null,
      idempotency_key: input.idempotencyKey,
      is_test: false,
      metadata: input.metadata,
    })
    .select("id")
    .single<{ id: string }>();

  if (error?.code === "23505") {
    return { reserved: false as const };
  }
  if (error || !data) {
    throw error ?? new Error("Lead alert delivery could not be reserved.");
  }

  return { reserved: true as const, id: data.id };
}

async function markAlertDelivery(
  supabase: SupabaseClient,
  input: { id: string; status: "sent" | "failed"; warning?: string | null },
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .schema("crm")
    .from("scheduled_notifications")
    .update({
      status: input.status,
      attempts: 1,
      sent_at: input.status === "sent" ? now : null,
      last_error: input.warning ?? null,
    })
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}

async function sendLeadAlertSms(
  supabase: SupabaseClient,
  details: LeadAlertDetails,
  sendSms: SmsSender = sendTenantSms,
): Promise<SendAlertResult> {
  const recipient = alertRecipient();
  if (!recipient) {
    return { ok: true, skipped: true, reason: "recipient_not_configured" };
  }

  const body = buildLeadAlertSmsBody(details);
  const reservation = await reserveAlertDelivery(supabase, {
    tenantId: details.tenantId,
    recipient,
    body,
    idempotencyKey: details.idempotencyKey,
    metadata: {
      source: details.sourceLabel,
      lead_id: details.leadId ?? null,
      customer_id: details.customerId ?? null,
      conversation_id: details.conversationId ?? null,
    },
  });

  if (!reservation.reserved) {
    return { ok: true, skipped: true, reason: "duplicate" };
  }

  const result = await sendSms({ to: recipient, body });
  await markAlertDelivery(supabase, {
    id: reservation.id,
    status: result.ok ? "sent" : "failed",
    warning: result.warning,
  });

  return result.ok ? { ok: true } : { ok: false, warning: result.warning ?? "Lead alert SMS failed." };
}

export async function sendWebsiteLeadAlertSms(
  supabase: SupabaseClient,
  input: WebsiteLeadAlertInput,
  sendSms?: SmsSender,
) {
  const service = [input.service, input.location, input.leadType].filter(Boolean).join(" / ");

  return sendLeadAlertSms(
    supabase,
    {
      tenantId: input.tenantId,
      sourceLabel: "website lead form",
      idempotencyKey: `website-lead:${input.leadId}:${input.submissionCount}`,
      name: input.name,
      phone: input.phone,
      postcode: input.postcode,
      service,
      issue: input.issue,
      leadId: input.leadId,
      customerId: input.customerId,
      submissionCount: input.submissionCount,
    },
    sendSms,
  );
}

function payloadString(payload: Record<string, unknown>, keys: string[]) {
  const metadata = payload.metadata && typeof payload.metadata === "object" ? (payload.metadata as Record<string, unknown>) : {};
  for (const key of keys) {
    const direct = cleanString(payload[key]);
    if (direct) return direct;

    const nested = cleanString(metadata[key]);
    if (nested) return nested;
  }
  return null;
}

function platformAlertSourceLabel(eventType: PlatformEventEnvelope["event_type"]) {
  if (eventType === "BookingConfirmed" || eventType === "booking.confirmed") {
    return "AI agent booking confirmed";
  }
  if (eventType === "EscalationRaised") {
    return "AI agent handoff";
  }
  return "AI agent qualified lead";
}

function isPlatformLeadAlertEvent(event: PlatformEventEnvelope) {
  return (
    event.source_system === "agentic_runtime" &&
    (event.event_type === "ConversationQualified" ||
      event.event_type === "EscalationRaised" ||
      event.event_type === "BookingConfirmed" ||
      event.event_type === "booking.confirmed" ||
      event.event_type === "lead.upserted")
  );
}

function conversationIdFromEvent(event: PlatformEventEnvelope) {
  if (event.aggregate.type === "conversation" && event.aggregate.id) {
    return event.aggregate.id;
  }
  return payloadString(event.payload, ["conversation_id", "conversationId", "session_id", "sessionId"]);
}

function formatBookingTime(payload: Record<string, unknown>) {
  const slot = payloadString(payload, ["booking_slot_label", "slot_label"]);
  if (slot) return slot;

  const start = payloadString(payload, ["booking_start_at", "starts_at", "start_at"]);
  if (!start) return null;

  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return start;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export async function sendPlatformLeadAlertSms(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  event: PlatformEventEnvelope,
  sendSms?: SmsSender,
): Promise<SendAlertResult> {
  if (!isPlatformLeadAlertEvent(event)) {
    return { ok: true, skipped: true, reason: "not_applicable" };
  }

  const conversationId = conversationIdFromEvent(event);
  const link = conversationId ? await getPlatformConversationLink(supabase, alias.tenant_id, conversationId) : null;
  const leadId = link?.lead_id ?? payloadString(event.payload, ["crm_lead_id", "lead_id", "platform_lead_id"]);

  return sendLeadAlertSms(
    supabase,
    {
      tenantId: alias.tenant_id,
      sourceLabel: platformAlertSourceLabel(event.event_type),
      idempotencyKey: `platform-lead:${event.source_system}:${event.idempotency_key}`,
      name: payloadString(event.payload, ["customer_name", "customerName", "full_name", "name"]),
      phone:
        link?.identity_phone ??
        payloadString(event.payload, ["customer_phone", "customerPhone", "phone", "identity_phone", "from"]),
      postcode: payloadString(event.payload, ["customer_postcode", "postcode", "zip"]),
      service: payloadString(event.payload, ["service", "service_name", "job_type", "treatmentType", "title"]),
      issue: payloadString(event.payload, ["issue", "summary", "qualification_summary", "problem_description", "notes"]),
      bookingTime: formatBookingTime(event.payload),
      leadId,
      customerId: link?.customer_id ?? payloadString(event.payload, ["crm_customer_id", "customer_id"]),
      conversationId,
    },
    sendSms,
  );
}
