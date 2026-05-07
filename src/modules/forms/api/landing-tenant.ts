import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export const LANDING_PAGE_TENANT_SLUG = "empire-home-solutions";

/**
 * Resolves the CRM tenant ID for the apex marketing site (no tenant
 * subdomain). Used when a request comes in on `crm.customerjourneys.ai`,
 * the Empire vercel preview, or any host the middleware doesn't recognise
 * as a tenant subdomain. Defaults to Empire so existing behaviour is
 * preserved.
 */
export async function resolveLandingPageTenantId(
  admin: ReturnType<typeof createCrmServiceRoleClient>,
): Promise<string> {
  const tenantId = await tenantIdFromSlug(admin, LANDING_PAGE_TENANT_SLUG);
  if (!tenantId) {
    throw new Error(`Tenant ${LANDING_PAGE_TENANT_SLUG} could not be resolved.`);
  }
  return tenantId;
}

/**
 * Look up a tenant ID by slug. Returns null if no tenant matches the slug.
 *
 * The middleware already stamps `x-tenant-slug` on every request based on
 * the host header (see `src/lib/tenant-host.ts`); route handlers should
 * read that header rather than parsing host themselves.
 */
export async function tenantIdFromSlug(
  admin: ReturnType<typeof createCrmServiceRoleClient>,
  slug: string,
): Promise<string | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const { data, error } = await admin
    .schema("crm")
    .from("tenants")
    .select("id")
    .eq("slug", trimmed)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}
