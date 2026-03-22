import { noteSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, parseJsonBody, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, noteSchema);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid note payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth.session;

  const payload = {
    ...parsed.data,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.schema("crm").from("notes").insert(payload).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ note: data });
}
