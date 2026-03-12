import { customerSchema } from "@/modules/crm/lib/validation";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { jsonError, jsonSuccess } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = customerSchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid customer payload.");
  }

  const supabase = await createCrmServerClient();
  const { data, error } = await supabase.schema("crm").from("customers").update(parsed.data).eq("id", id).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  await upsertCustomFieldValues({
    entityType: "customer",
    entityId: id,
    values: extractCustomFieldValues(body),
  });

  return jsonSuccess({ customer: data });
}
