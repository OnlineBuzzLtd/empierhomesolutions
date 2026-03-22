import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { CrmRole, UserProfile } from "@/modules/crm/types";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { getCrmEnv } from "@/modules/crm/lib/env";

export async function getCrmSession() {
  const env = getCrmEnv();
  if (!env.enabled) {
    return { user: null as User | null, profile: null as UserProfile | null, configured: false };
  }

  const supabase = await createCrmServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, configured: true };
  }

  const { data: profile } = await supabase
    .schema("crm")
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<UserProfile>();

  return { user, profile: profile ?? null, configured: true };
}

export async function requireCrmUser() {
  const session = await getCrmSession();
  if (!session.configured) {
    return session;
  }

  if (!session.user) {
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
