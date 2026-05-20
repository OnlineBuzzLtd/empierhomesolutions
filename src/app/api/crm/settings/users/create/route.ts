import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import {
  buildCreatedUserProfilePayload,
  createUserSchema,
  generateUserPassword,
  normalizeEmail,
} from "@/modules/crm/lib/user-admin";

export const runtime = "nodejs";

// Tenant-admin creates a new user with a password they can log in with
// directly. Unlike the invite endpoint, this skips the magic-link round
// trip — used for placeholder-email engineers (e.g. shane@<tenant>.local)
// who can't actually receive mail.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.");
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid user payload.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }
  const { tenant } = auth.session;

  const admin = createCrmServiceRoleClient();
  const email = normalizeEmail(parsed.data.email);
  const generatedPassword = parsed.data.password ?? generateUserPassword();

  const { data: createdAuthUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name.trim(),
      created_by_tenant_id: tenant.id,
    },
  });

  if (createUserError || !createdAuthUser.user) {
    return jsonError(createUserError?.message ?? "Failed to create auth user.", 400);
  }

  const userId = createdAuthUser.user.id;
  const profilePayload = buildCreatedUserProfilePayload({
    tenantId: tenant.id,
    userId,
    data: parsed.data,
    normalizedEmail: email,
  });

  const { data: profile, error: profileError } = await admin
    .schema("crm")
    .from("user_profiles")
    .upsert(profilePayload, { onConflict: "tenant_id,user_id" })
    .select("*")
    .single();

  if (profileError) {
    // Best-effort rollback so we don't leak orphan auth users on failure.
    await admin.auth.admin.deleteUser(userId);
    return jsonError(profileError.message, 500);
  }

  const { error: membershipError } = await admin
    .schema("crm")
    .from("tenant_memberships")
    .upsert(
      {
        tenant_id: tenant.id,
        user_id: userId,
        role: parsed.data.role,
        active: true,
        is_owner: false,
      },
      { onConflict: "tenant_id,user_id" },
    );

  if (membershipError) {
    return jsonError(membershipError.message, 500);
  }

  return jsonSuccess({
    profile,
    user_id: userId,
    email,
    // Only returned when we generated it. The caller MUST capture this —
    // we don't persist it anywhere recoverable.
    generated_password: parsed.data.password ? null : generatedPassword,
  });
}
