import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduledNotificationChannel } from "@/modules/crm/notifications/scheduler";

const STOP_PATTERN = /^[\s"'.,;:!?]*(stop|stopall|unsubscribe|cancel|end|quit)[\s"'.,;:!?]*$/i;
const START_PATTERN = /^[\s"'.,;:!?]*(start|unstop|subscribe|yes)[\s"'.,;:!?]*$/i;

export function normalizeContactForOptOut(contact: string, channel: ScheduledNotificationChannel) {
  const trimmed = contact.trim();
  if (channel === "email") {
    return trimmed.toLowerCase();
  }
  return trimmed.replace(/^whatsapp:/i, "").replace(/\s+/g, "");
}

export function classifyOptOutKeyword(body: string) {
  if (STOP_PATTERN.test(body)) {
    return "stop" as const;
  }
  if (START_PATTERN.test(body)) {
    return "start" as const;
  }
  return null;
}

export async function isContactOptedOut(
  supabase: SupabaseClient,
  input: { tenantId: string; contact: string; channel: ScheduledNotificationChannel },
) {
  const normalized = normalizeContactForOptOut(input.contact, input.channel);
  const { data, error } = await supabase
    .schema("crm")
    .from("contact_opt_outs")
    .select("id, opted_in_at")
    .eq("tenant_id", input.tenantId)
    .eq("normalized_contact", normalized)
    .eq("channel", input.channel)
    .maybeSingle<{ id: string; opted_in_at: string | null }>();

  if (error) {
    throw error;
  }

  return Boolean(data && !data.opted_in_at);
}

export async function recordContactOptOut(
  supabase: SupabaseClient,
  input: { tenantId: string; contact: string; channel: ScheduledNotificationChannel; source?: string },
) {
  const normalized = normalizeContactForOptOut(input.contact, input.channel);
  const { error } = await supabase
    .schema("crm")
    .from("contact_opt_outs")
    .upsert(
      {
        tenant_id: input.tenantId,
        contact: input.contact,
        normalized_contact: normalized,
        channel: input.channel,
        source: input.source ?? "manual",
        opted_out_at: new Date().toISOString(),
        opted_in_at: null,
      },
      { onConflict: "tenant_id,normalized_contact,channel" },
    );
  if (error) {
    throw error;
  }
}

export async function recordContactOptIn(
  supabase: SupabaseClient,
  input: { tenantId: string; contact: string; channel: ScheduledNotificationChannel },
) {
  const normalized = normalizeContactForOptOut(input.contact, input.channel);
  const { error } = await supabase
    .schema("crm")
    .from("contact_opt_outs")
    .update({ opted_in_at: new Date().toISOString() })
    .eq("tenant_id", input.tenantId)
    .eq("normalized_contact", normalized)
    .eq("channel", input.channel);
  if (error) {
    throw error;
  }
}
