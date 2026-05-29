import type { SupabaseClient } from "@supabase/supabase-js";
import { renderNotificationTemplate } from "@/modules/crm/notifications/render";
import { scheduleNotification } from "@/modules/crm/notifications/scheduler";

const LEAD_CHASE_STEPS = [
  { key: "lead_chase_24h", delayHours: 0 },
  { key: "lead_chase_3d", delayHours: 72 },
] as const;

type LeadChaseLead = {
  id: string;
  tenant_id: string;
  status: string;
  next_action_at: string | null;
  is_demo?: boolean | null;
  customer?: {
    id: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  service?: {
    name: string | null;
  } | null;
};

type SupabaseRelation<T> = T | T[] | null | undefined;

function firstRelation<T>(value: SupabaseRelation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

async function leadHasAppointment(supabase: SupabaseClient, leadId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("appointments")
    .select("id")
    .eq("lead_id", leadId)
    .neq("status", "cancelled")
    .limit(1);
  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

async function clearNextAction(supabase: SupabaseClient, tenantId: string, leadId: string) {
  const { error } = await supabase
    .schema("crm")
    .from("leads")
    .update({ next_action_at: null })
    .eq("tenant_id", tenantId)
    .eq("id", leadId);
  if (error) {
    throw error;
  }
}

export async function scheduleLeadChaseSequence(
  supabase: SupabaseClient,
  input: { tenantId: string; leadId: string; now?: Date },
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("leads")
    .select(
      "id, tenant_id, status, next_action_at, is_demo, customer:customers(id, full_name, phone), service:services(name)",
    )
    .eq("tenant_id", input.tenantId)
    .eq("id", input.leadId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return { scheduled: 0, skipped: "lead_not_found" };
  }

  const row = data as unknown as Omit<LeadChaseLead, "customer" | "service"> & {
    customer: SupabaseRelation<NonNullable<LeadChaseLead["customer"]>>;
    service: SupabaseRelation<NonNullable<LeadChaseLead["service"]>>;
  };
  const lead: LeadChaseLead = {
    ...row,
    customer: firstRelation(row.customer),
    service: firstRelation(row.service),
  };

  if (!["new", "contacted"].includes(lead.status)) {
    return { scheduled: 0, skipped: "lead_status_not_chaseable" };
  }
  if (await leadHasAppointment(supabase, lead.id)) {
    await clearNextAction(supabase, input.tenantId, lead.id);
    return { scheduled: 0, skipped: "appointment_exists" };
  }

  const recipient = lead.customer?.phone?.trim();
  if (!recipient) {
    return { scheduled: 0, skipped: "missing_customer_phone" };
  }

  const now = input.now ?? new Date();
  const variables = {
    customer_name: lead.customer?.full_name?.trim() || "there",
    service_name: lead.service?.name?.trim() || "the work",
  };

  for (const step of LEAD_CHASE_STEPS) {
    const rendered = await renderNotificationTemplate(supabase, {
      tenantId: input.tenantId,
      key: step.key,
      channel: "sms",
      variables,
    });
    await scheduleNotification(supabase, {
      tenantId: input.tenantId,
      recipient,
      channel: "sms",
      templateKey: rendered.template.key,
      payload: { body: rendered.body },
      dispatchAt: new Date(now.getTime() + step.delayHours * 60 * 60 * 1000),
      idempotencyKey: `lead:${lead.id}:chase:${step.key}`,
      isTest: lead.is_demo === true,
      metadata: {
        sequence: "lead_chase",
        lead_id: lead.id,
        customer_id: lead.customer?.id ?? null,
        step: step.key,
      },
    });
  }

  await clearNextAction(supabase, input.tenantId, lead.id);
  return { scheduled: LEAD_CHASE_STEPS.length, skipped: null };
}

export async function scheduleDueLeadChases(
  supabase: SupabaseClient,
  options: { now?: Date; limit?: number } = {},
) {
  const now = options.now ?? new Date();
  const { data, error } = await supabase
    .schema("crm")
    .from("leads")
    .select("id, tenant_id")
    .in("status", ["new", "contacted"])
    .not("next_action_at", "is", null)
    .lte("next_action_at", now.toISOString())
    .order("next_action_at", { ascending: true })
    .limit(options.limit ?? 50);
  if (error) {
    throw error;
  }

  let scheduled = 0;
  let skipped = 0;
  for (const lead of (data ?? []) as Array<{ id: string; tenant_id: string }>) {
    const result = await scheduleLeadChaseSequence(supabase, {
      tenantId: lead.tenant_id,
      leadId: lead.id,
      now,
    });
    scheduled += result.scheduled;
    skipped += result.skipped ? 1 : 0;
  }

  return { leads: data?.length ?? 0, scheduled, skipped };
}
