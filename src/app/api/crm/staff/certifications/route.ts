import { userCertificationSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const parsed = userCertificationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid certification payload.");
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase.schema("crm").from("user_certifications").insert(parsed.data).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ certification: data });
}
