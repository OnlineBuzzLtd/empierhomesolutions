import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { resetUserPasswordSchema } from "@/modules/crm/lib/password-validation";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { generateUserPassword } from "@/modules/crm/lib/user-admin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ user_id: string }> }) {
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

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (typeof payload.user_id === "string" && payload.user_id !== userId) {
    return jsonError("User id does not match the request path.");
  }

  const parsed = resetUserPasswordSchema.safeParse({ ...payload, user_id: userId });
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid password payload.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant, membership, profile } = auth.session;
  if (membership.is_demo || profile?.is_demo) {
    return jsonError("Demo mode is read-only.", 403);
  }

  const { data: targetProfile, error: profileError } = await supabase
    .schema("crm")
    .from("user_profiles")
    .select("user_id,email,full_name")
    .eq("tenant_id", tenant.id)
    .eq("user_id", parsed.data.user_id)
    .maybeSingle();

  if (profileError) {
    return jsonError(profileError.message, 500);
  }

  if (!targetProfile) {
    return jsonError("User not found for this tenant.", 404);
  }

  const generated = !parsed.data.password;
  const password = parsed.data.password ?? generateUserPassword();
  const admin = createCrmServiceRoleClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(parsed.data.user_id, {
    password,
  });

  if (updateError) {
    return jsonError(updateError.message || "Failed to reset password.", 400);
  }

  return jsonSuccess({
    user_id: parsed.data.user_id,
    email: targetProfile.email,
    generated_password: generated ? password : null,
  });
}
