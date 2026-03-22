import { requiredDocumentRuleSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const parsed = requiredDocumentRuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid required document rule payload.");
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("required_document_rules")
    .upsert(parsed.data)
    .select("*")
    .single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ rule: data });
}
