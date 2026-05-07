import { headers } from "next/headers";
import type { Tenant } from "@/modules/crm/types";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

// Resolve the tenant that owns the current request, based on the host
// header stamped by `middleware.ts`. Unlike `getCrmSession`, this helper
// works for unauthenticated requests too (signup, public lead intake) so
// per-tenant branding can apply before a user is signed in.
//
// Returns `null` when the host points at the marketing apex or at a
// preview/localhost deployment, in which case callers should fall back
// to the authenticated user's membership.

export async function resolveTenantFromRequest(): Promise<Tenant | null> {
  const headerStore = await headers();
  const slug = headerStore.get("x-tenant-slug");
  if (!slug) {
    return null;
  }

  const supabase = createCrmServiceRoleClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Tenant>();

  if (error) {
    return null;
  }

  return data ?? null;
}

export async function getTenantSlugFromRequest(): Promise<string | null> {
  const headerStore = await headers();
  return headerStore.get("x-tenant-slug");
}
