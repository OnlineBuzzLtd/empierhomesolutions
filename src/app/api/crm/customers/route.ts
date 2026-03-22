import { customerSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid customer payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase.schema("crm").from("customers").insert(parsed.data).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  const customFieldValues = extractCustomFieldValues(body);
  await upsertCustomFieldValues({
    entityType: "customer",
    entityId: data.id,
    values: customFieldValues,
  });

  return jsonSuccess({ customer: data });
}
