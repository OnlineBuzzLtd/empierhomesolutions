import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { updateUserStatusSchema } from "@/modules/crm/lib/user-admin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tenant-admin activates or deactivates a user_profile. Deactivation is
// soft — it hides the profile from the engineer/staff dropdowns
// (see getAssignableEngineerOptions) but preserves their name on any
// historical job_assignees rows. We also flip the tenant_membership flag
// so the user can't load the CRM at all while deactivated.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ user_id: string }> },
) {
  const { user_id: userId } = await context.params;
  if (!UUID_RE.test(userId)) {
    return jsonError("Invalid user id.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.");
  }

  const parsed = updateUserStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid status payload.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, tenant, user } = auth.session;

  if (userId === user.id && parsed.data.active === false) {
    return jsonError("You cannot deactivate your own account.", 400);
  }

  // Deactivating the last manager/admin locks the whole tenant out of user
  // administration: crm.is_manager_or_admin requires an ACTIVE membership, so
  // once the final one is switched off nobody can switch anybody back on. Block
  // it here rather than leaving a tenant stranded needing a service-role script.
  if (parsed.data.active === false) {
    const { data: activeManagers, error: managersError } = await supabase
      .schema("crm")
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .in("role", ["management", "admin"]);

    if (managersError) {
      return jsonError(managersError.message, 500);
    }

    const remaining = (activeManagers ?? []).filter(
      (row: { user_id: string }) => row.user_id !== userId,
    );
    const targetIsManager = (activeManagers ?? []).some(
      (row: { user_id: string }) => row.user_id === userId,
    );

    if (targetIsManager && remaining.length === 0) {
      return jsonError(
        "This is the last active admin. Promote another user to admin before deactivating this one.",
        400,
      );
    }
  }

  const [{ data: profile, error: profileError }, { error: membershipError }] = await Promise.all([
    supabase
      .schema("crm")
      .from("user_profiles")
      .update({ active: parsed.data.active })
      .eq("tenant_id", tenant.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle(),
    supabase
      .schema("crm")
      .from("tenant_memberships")
      .update({ active: parsed.data.active })
      .eq("tenant_id", tenant.id)
      .eq("user_id", userId),
  ]);

  if (profileError || membershipError) {
    return jsonError(profileError?.message ?? membershipError?.message ?? "Failed to update status.", 500);
  }

  if (!profile) {
    return jsonError("User not found for this tenant.", 404);
  }

  return jsonSuccess({ profile });
}
