import { expenseSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid expense payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth.session;

  const payload = {
    ...parsed.data,
    created_by: resolveCreatedByUserId(user),
  };

  const { data, error } = await supabase.schema("crm").from("expenses").insert(payload).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ expense: data });
}
