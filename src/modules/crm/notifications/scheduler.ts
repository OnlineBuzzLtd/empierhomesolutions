import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTenantBranding, sendTenantEmail } from "@/modules/crm/lib/emailer";
import { sendTenantSms } from "@/modules/crm/lib/sms-sender";
import { isContactOptedOut } from "@/modules/crm/notifications/opt-outs";

export type ScheduledNotificationChannel = "sms" | "whatsapp" | "email";
export type ScheduledNotificationStatus = "pending" | "sent" | "failed" | "cancelled";

type ScheduledNotificationRow = {
  id: string;
  tenant_id: string;
  recipient: string;
  channel: ScheduledNotificationChannel;
  template_key: string;
  payload: Record<string, unknown>;
  status: ScheduledNotificationStatus;
  attempts: number;
  max_attempts: number;
  dispatch_at: string;
  next_attempt_at: string | null;
  is_test: boolean;
};

export type NotificationSenders = {
  sendEmail?: typeof sendTenantEmail;
  sendSms?: typeof sendTenantSms;
};

export type ScheduleNotificationInput = {
  tenantId: string;
  recipient: string;
  channel: ScheduledNotificationChannel;
  templateKey: string;
  payload: Record<string, unknown>;
  dispatchAt: string | Date;
  idempotencyKey?: string | null;
  isTest?: boolean;
  metadata?: Record<string, unknown>;
};

function asIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function nextAttemptAt(now: Date, attempts: number) {
  const delayMinutes = Math.min(60, 5 * 2 ** Math.max(attempts - 1, 0));
  return new Date(now.getTime() + delayMinutes * 60 * 1000).toISOString();
}

export async function scheduleNotification(supabase: SupabaseClient, input: ScheduleNotificationInput) {
  const payload = {
    tenant_id: input.tenantId,
    recipient: input.recipient,
    channel: input.channel,
    template_key: input.templateKey,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    dispatch_at: asIso(input.dispatchAt),
    next_attempt_at: null,
    sent_at: null,
    cancelled_at: null,
    last_error: null,
    idempotency_key: input.idempotencyKey ?? null,
    is_test: input.isTest ?? false,
    metadata: input.metadata ?? {},
  };

  const query = supabase.schema("crm").from("scheduled_notifications");
  const request = input.idempotencyKey
    ? query.upsert(payload, { onConflict: "tenant_id,idempotency_key" }).select("*").single()
    : query.insert(payload).select("*").single();

  const { data, error } = await request;
  if (error) {
    throw error;
  }
  return data;
}

export async function cancelScheduledNotifications(
  supabase: SupabaseClient,
  input: { tenantId: string; idempotencyKeys?: string[]; metadataMatch?: Record<string, string> },
) {
  let query = supabase
    .schema("crm")
    .from("scheduled_notifications")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("status", "pending");

  if (input.idempotencyKeys?.length) {
    query = query.in("idempotency_key", input.idempotencyKeys);
  }

  for (const [key, value] of Object.entries(input.metadataMatch ?? {})) {
    query = query.eq(`metadata->>${key}`, value);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
}

async function sendNotification(
  supabase: SupabaseClient,
  row: ScheduledNotificationRow,
  senders: NotificationSenders,
) {
  if (row.channel === "email") {
    const subject = getString(row.payload.subject);
    const html = getString(row.payload.html) ?? undefined;
    const text = getString(row.payload.text) ?? getString(row.payload.body) ?? undefined;
    if (!subject || (!html && !text)) {
      throw new Error("Email notification payload requires subject and html or text.");
    }
    const branding = await loadTenantBranding(supabase, row.tenant_id);
    const result = await (senders.sendEmail ?? sendTenantEmail)({
      to: row.recipient,
      subject,
      html,
      text,
      branding,
      tag: row.template_key,
    });
    if (!result.ok) {
      throw new Error(result.warning ?? "Email send failed.");
    }
    return;
  }

  const body = getString(row.payload.body) ?? getString(row.payload.text);
  if (!body) {
    throw new Error("SMS notification payload requires body.");
  }
  const result = await (senders.sendSms ?? sendTenantSms)({
    to: row.recipient,
    body,
    messagingServiceSid: getString(row.payload.messagingServiceSid),
  });
  if (!result.ok) {
    throw new Error(result.warning ?? "SMS send failed.");
  }
}

export async function dispatchDueNotifications(
  supabase: SupabaseClient,
  options: {
    now?: Date;
    limit?: number;
    onlyId?: string;
    allowTestDispatch?: boolean;
    senders?: NotificationSenders;
  } = {},
) {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const limit = options.limit ?? 50;
  let query = supabase
    .schema("crm")
    .from("scheduled_notifications")
    .select("*")
    .eq("status", "pending")
    .lte("dispatch_at", nowIso)
    .order("dispatch_at", { ascending: true });

  if (options.onlyId) {
    query = query.eq("id", options.onlyId);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    throw error;
  }

  let sent = 0;
  let failed = 0;
  let cancelled = 0;
  let skipped = 0;

  for (const row of ((data ?? []) as ScheduledNotificationRow[]).filter((candidate) => {
    return !candidate.next_attempt_at || new Date(candidate.next_attempt_at).getTime() <= now.getTime();
  })) {
    const attempts = row.attempts + 1;
    try {
      if (row.is_test && !options.allowTestDispatch) {
        const { error: updateError } = await supabase
          .schema("crm")
          .from("scheduled_notifications")
          .update({
            status: "cancelled",
            attempts,
            cancelled_at: nowIso,
            last_error: "Test notification skipped by dispatcher.",
          })
          .eq("id", row.id)
          .eq("status", "pending");
        if (updateError) throw updateError;
        cancelled += 1;
        continue;
      }

      if (await isContactOptedOut(supabase, { tenantId: row.tenant_id, contact: row.recipient, channel: row.channel })) {
        const { error: updateError } = await supabase
          .schema("crm")
          .from("scheduled_notifications")
          .update({
            status: "cancelled",
            attempts,
            cancelled_at: nowIso,
            last_error: "Recipient has opted out of this channel.",
          })
          .eq("id", row.id)
          .eq("status", "pending");
        if (updateError) throw updateError;
        cancelled += 1;
        continue;
      }

      await sendNotification(supabase, row, options.senders ?? {});
      const { error: updateError } = await supabase
        .schema("crm")
        .from("scheduled_notifications")
        .update({
          status: "sent",
          attempts,
          sent_at: nowIso,
          last_error: null,
        })
        .eq("id", row.id)
        .eq("status", "pending");
      if (updateError) throw updateError;
      sent += 1;
    } catch (err) {
      const terminal = attempts >= row.max_attempts;
      const { error: updateError } = await supabase
        .schema("crm")
        .from("scheduled_notifications")
        .update({
          status: terminal ? "failed" : "pending",
          attempts,
          next_attempt_at: terminal ? null : nextAttemptAt(now, attempts),
          last_error: err instanceof Error ? err.message : "Notification dispatch failed.",
        })
        .eq("id", row.id)
        .eq("status", "pending");
      if (updateError) throw updateError;
      failed += terminal ? 1 : 0;
      skipped += terminal ? 0 : 1;
    }
  }

  return { selected: data?.length ?? 0, sent, failed, cancelled, retried: skipped };
}
