import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

export function extractCustomFieldValues(input: Record<string, FormDataEntryValue | null>) {
  const entries = Object.entries(input)
    .filter(([key, value]) => key.startsWith("custom_field_") && typeof value === "string" && value.trim().length > 0)
    .map(([key, value]) => ({
      field_definition_id: key.replace("custom_field_", ""),
      value_json: value,
    }));

  return entries;
}

export async function upsertCustomFieldValues(params: {
  entityType: string;
  entityId: string;
  values: Array<{ field_definition_id: string; value_json: unknown }>;
}) {
  if (params.values.length === 0) {
    return;
  }

  const supabase = await createCrmServerClient();
  const payload = params.values.map((value) => ({
    ...value,
    entity_type: params.entityType,
    entity_id: params.entityId,
  }));

  await supabase.schema("crm").from("custom_field_values").upsert(payload, {
    onConflict: "field_definition_id,entity_type,entity_id",
  });
}
