import { customFieldDefinitionSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const parsed = customFieldDefinitionSchema.safeParse({
    ...body,
    options: typeof body.options_csv === "string" && body.options_csv.trim().length > 0 ? body.options_csv.split(",").map((value: string) => value.trim()) : null,
  });
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid custom field payload.");
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("custom_field_definitions")
    .upsert(parsed.data)
    .select("*")
    .single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ customField: data });
}
