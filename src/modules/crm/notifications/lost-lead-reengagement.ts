import type { SupabaseClient } from "@supabase/supabase-js";
import { renderNotificationTemplate } from "@/modules/crm/notifications/render";
import { scheduleNotification } from "@/modules/crm/notifications/scheduler";

type LostLeadRow = {
  id: string;
  tenant_id: string;
  created_at: string;
  is_demo?: boolean | null;
  customer?: {
    id: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  service?: {
    name: string | null;
  } | null;
  tenant?: {
    name: string | null;
  } | null;
};

type SupabaseRelation<T> = T | T[] | null | undefined;

function firstRelation<T>(value: SupabaseRelation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

async function tenantAllowsReengagement(
  supabase: SupabaseClient,
  tenantId: string,
  cache: Map<string, boolean>,
) {
  const cached = cache.get(tenantId);
  if (cached !== undefined) {
    return cached;
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("tenant_settings")
    .select("lost_lead_reengagement_enabled")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  const enabled = data?.lost_lead_reengagement_enabled !== false;
  cache.set(tenantId, enabled);
  return enabled;
}

async function markLeadReengaged(supabase: SupabaseClient, tenantId: string, leadId: string, now: Date) {
  const { error } = await supabase
    .schema("crm")
    .from("leads")
    .update({ re_engaged_at: now.toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", leadId);
  if (error) {
    throw error;
  }
}

export async function scheduleDueLostLeadReengagements(
  supabase: SupabaseClient,
  options: { now?: Date; limit?: number } = {},
) {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .schema("crm")
    .from("leads")
    .select(
      "id, tenant_id, created_at, is_demo, customer:customers(id, full_name, phone), service:services(name), tenant:tenants(name)",
    )
    .eq("status", "lost")
    .is("re_engaged_at", null)
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(options.limit ?? 50);
  if (error) {
    throw error;
  }

  let scheduled = 0;
  let skipped = 0;
  const enabledByTenant = new Map<string, boolean>();

  for (const raw of data ?? []) {
    const row = raw as unknown as Omit<LostLeadRow, "customer" | "service" | "tenant"> & {
      customer: SupabaseRelation<NonNullable<LostLeadRow["customer"]>>;
      service: SupabaseRelation<NonNullable<LostLeadRow["service"]>>;
      tenant: SupabaseRelation<NonNullable<LostLeadRow["tenant"]>>;
    };
    const lead: LostLeadRow = {
      ...row,
      customer: firstRelation(row.customer),
      service: firstRelation(row.service),
      tenant: firstRelation(row.tenant),
    };

    if (!(await tenantAllowsReengagement(supabase, lead.tenant_id, enabledByTenant))) {
      skipped += 1;
      continue;
    }

    const recipient = lead.customer?.phone?.trim();
    if (!recipient) {
      skipped += 1;
      continue;
    }

    const rendered = await renderNotificationTemplate(supabase, {
      tenantId: lead.tenant_id,
      key: "lost_lead_reengage_90d",
      channel: "sms",
      variables: {
        customer_name: lead.customer?.full_name?.trim() || "there",
        business_name: lead.tenant?.name?.trim() || "the team",
        service_name: lead.service?.name?.trim() || "the work",
      },
    });

    await scheduleNotification(supabase, {
      tenantId: lead.tenant_id,
      recipient,
      channel: "sms",
      templateKey: rendered.template.key,
      payload: { body: rendered.body },
      dispatchAt: now,
      idempotencyKey: `lead:${lead.id}:lost_reengage_90d`,
      isTest: lead.is_demo === true,
      metadata: {
        sequence: "lost_lead_reengagement",
        lead_id: lead.id,
        customer_id: lead.customer?.id ?? null,
      },
    });
    await markLeadReengaged(supabase, lead.tenant_id, lead.id, now);
    scheduled += 1;
  }

  return { leads: data?.length ?? 0, scheduled, skipped };
}
