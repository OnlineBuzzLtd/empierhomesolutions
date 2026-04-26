import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export const LANDING_PAGE_TENANT_SLUG = "empire-home-solutions";

/**
 * Resolves the CRM tenant ID for the public marketing site. Hardcoded to
 * Empire today (matching the lead-form pattern). When we add multi-tenant
 * white-label widgets, this is the single place to swap for host-based
 * resolution via `resolveTenantFromHost()`.
 */
export async function resolveLandingPageTenantId(
  admin: ReturnType<typeof createCrmServiceRoleClient>,
): Promise<string> {
  const { data: tenant, error } = await admin
    .schema("crm")
    .from("tenants")
    .select("id")
    .eq("slug", LANDING_PAGE_TENANT_SLUG)
    .maybeSingle();

  if (error || !tenant) {
    throw new Error(error?.message ?? `Tenant ${LANDING_PAGE_TENANT_SLUG} could not be resolved.`);
  }

  return tenant.id;
}
