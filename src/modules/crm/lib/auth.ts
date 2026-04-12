import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { CrmRole, Tenant, TenantBranding, TenantMembership, TenantSettings, UserProfile } from "@/modules/crm/types";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { buildPlatformE2eMockSession } from "@/modules/platform/lib/e2e-fixtures";

export const crmActiveTenantCookieName = "crm_active_tenant";

export async function getCrmSession() {
  const env = getCrmEnv();
  if (env.crmE2ePlatformFixturesEnabled) {
    return buildPlatformE2eMockSession();
  }

  if (!env.enabled) {
    return {
      user: null as User | null,
      profile: null as UserProfile | null,
      membership: null as TenantMembership | null,
      memberships: [] as TenantMembership[],
      tenant: null as Tenant | null,
      branding: null as TenantBranding | null,
      settings: null as TenantSettings | null,
      configured: false,
    };
  }

  const supabase = await createCrmServerClient();
  const cookieStore = await cookies();
  const requestedTenantId = cookieStore.get(crmActiveTenantCookieName)?.value ?? null;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, membership: null, memberships: [], tenant: null, branding: null, settings: null, configured: true };
  }

  const { data: memberships } = await supabase
    .schema("crm")
    .from("tenant_memberships")
    .select("*, tenant:tenants(*)")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("is_owner", { ascending: false })
    .order("created_at", { ascending: true });

  const resolvedMemberships = (memberships ?? []) as Array<TenantMembership & { tenant?: Tenant | null }>;
  const membership =
    resolvedMemberships.find((entry) => entry.tenant_id === requestedTenantId) ??
    resolvedMemberships[0] ??
    null;
  const tenant = membership?.tenant ?? null;

  if (!membership || !tenant) {
    return { user, profile: null, membership: null, memberships: resolvedMemberships, tenant: null, branding: null, settings: null, configured: true };
  }

  const [{ data: profile }, { data: branding }, { data: settings }] = await Promise.all([
    supabase
      .schema("crm")
      .from("user_profiles")
      .select("*")
      .eq("tenant_id", membership.tenant_id)
      .eq("user_id", user.id)
      .maybeSingle<UserProfile>(),
    supabase
      .schema("crm")
      .from("tenant_branding")
      .select("*")
      .eq("tenant_id", membership.tenant_id)
      .maybeSingle<TenantBranding>(),
    supabase
      .schema("crm")
      .from("tenant_settings")
      .select("*")
      .eq("tenant_id", membership.tenant_id)
      .maybeSingle<TenantSettings>(),
  ]);

  const derivedProfile =
    profile ??
    ({
      id: membership.id,
      tenant_id: membership.tenant_id,
      user_id: user.id,
      role: membership.role,
      full_name: String(user.user_metadata.full_name ?? user.email?.split("@")[0] ?? "CRM User"),
      phone: null,
      email: user.email ?? null,
      emergency_contact: null,
      agreed_hours: null,
      pay_type: null,
      pay_notes: null,
      contract_file_url: null,
      active: membership.active,
      is_demo: membership.is_demo,
      demo_scenario_key: membership.demo_scenario_key ?? null,
      created_at: membership.created_at,
      updated_at: membership.updated_at,
    } satisfies UserProfile);

  return {
    user,
    profile: derivedProfile,
    membership,
    memberships: resolvedMemberships,
    tenant,
    branding: branding ?? null,
    settings: settings ?? null,
    configured: true,
  };
}

export async function requireCrmUser() {
  const session = await getCrmSession();
  if (!session.configured) {
    return session;
  }

  if (!session.user || !session.tenant || !session.membership) {
    const headerStore = await headers();
    const nextPath = headerStore.get("x-crm-next");
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }

  return session;
}

export function userCanManageSettings(role: CrmRole | null | undefined) {
  return role === "management" || role === "admin";
}

export async function requireSettingsAccess() {
  const session = await requireCrmUser();
  const role = session.profile?.role;

  if (!session.configured) {
    return session;
  }

  if (!userCanManageSettings(role)) {
    redirect("/dashboard");
  }

  return session;
}
