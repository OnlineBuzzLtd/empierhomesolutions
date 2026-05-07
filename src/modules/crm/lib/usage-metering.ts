// Per-tenant usage metering.
//
// The table `crm.usage_events` is the canonical source for billing and
// observability dashboards. Call `recordUsageEvent` from anywhere the
// CRM measures a billable unit of work: SMS segments, AI minutes,
// booked appointments, etc. Failures are logged but never thrown so
// metering can never take down a business request.

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export type UsageEventInput = {
  tenantId: string;
  eventType: string;
  quantity?: number;
  unit?: string;
  source?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown> | null;
};

export async function recordUsageEvent(
  input: UsageEventInput,
  adminOverride?: SupabaseClient,
): Promise<{ ok: boolean; warning?: string }> {
  let admin: SupabaseClient | null = adminOverride ?? null;
  if (!admin) {
    try {
      admin = createCrmServiceRoleClient();
    } catch (error) {
      return { ok: false, warning: error instanceof Error ? error.message : "usage_metering_unavailable" };
    }
  }

  const { error } = await admin
    .schema("crm")
    .from("usage_events")
    .insert({
      tenant_id: input.tenantId,
      event_type: input.eventType,
      quantity: input.quantity ?? 1,
      unit: input.unit ?? "count",
      source: input.source ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      metadata: input.metadata ?? null,
    });

  if (error) {
    return { ok: false, warning: error.message };
  }

  return { ok: true };
}
