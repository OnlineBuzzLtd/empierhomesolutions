import type { SupabaseClient } from "@supabase/supabase-js";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { getCustomerJourneysRuntimeLink } from "@/modules/crm/lib/customerjourneys";

// Best-effort forward sync from the Empire CRM into the
// customerjourneys-platform-api. When an operator edits a lead (or its
// customer) in the CRM we POST to a platform-api internal endpoint so the
// voice agent picks up the latest details on the next call. This path is
// intentionally fire-and-forget: a transient platform-api outage must not
// block a CRM write.

type PlatformLeadUpdatePayload = {
  lead_id: string;
  tenant_id: string;
  status?: string | null;
  source?: string | null;
  notes?: string | null;
  problem_description?: string | null;
  urgency_level?: string | null;
  preferred_date_text?: string | null;
  preferred_time_window?: string | null;
  affected_area?: string | null;
  customer?: {
    id?: string | null;
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
    address_line1?: string | null;
    city?: string | null;
    postcode?: string | null;
  };
};

function normalizeBaseUrl(value: string | null | undefined) {
  return value?.trim().replace(/\/$/, "") ?? null;
}

export async function publishLeadUpdateToPlatform(
  supabase: SupabaseClient,
  tenantId: string,
  payload: Omit<PlatformLeadUpdatePayload, "tenant_id">,
): Promise<{ ok: boolean; reason?: string }> {
  const env = getCrmEnv();
  const link = await getCustomerJourneysRuntimeLink(supabase, tenantId).catch(() => null);
  const baseUrl =
    normalizeBaseUrl(env.customerJourneysPlatformApiBaseUrlOverride) ??
    normalizeBaseUrl(link?.platform_api_base_url) ??
    normalizeBaseUrl(env.customerJourneysPlatformApiBaseUrl);
  const token = env.customerJourneysInternalApiToken ?? env.customerJourneysAdminApiToken;

  if (!baseUrl || !token || !link?.customerjourneys_tenant_id) {
    return { ok: false, reason: "runtime_not_configured" };
  }

  const body: PlatformLeadUpdatePayload = {
    ...payload,
    tenant_id: link.customerjourneys_tenant_id,
  };

  const url = `${baseUrl}/v1/internal/tenants/${encodeURIComponent(link.customerjourneys_tenant_id)}/leads/${encodeURIComponent(payload.lead_id)}`;

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-internal-service-token": env.customerJourneysInternalApiToken ?? "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (response.status === 404) {
      // The platform-api is older than this CRM build; skip silently rather
      // than spamming the operator with transient errors.
      return { ok: false, reason: "endpoint_not_available" };
    }

    if (!response.ok) {
      return { ok: false, reason: `status_${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "platform_sync_failed";
    return { ok: false, reason: message };
  }
}
