import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

export function extractCustomFieldValues(input: Record<string, unknown>) {
  const entries = Object.entries(input)
    .filter(([key, value]) => key.startsWith("custom_field_") && value !== null && value !== undefined)
    .map(([key, value]) => ({
      field_definition_id: key.replace("custom_field_", ""),
      value_json: value,
    }));

  return entries;
}

export function isCustomFieldValuePresent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => isCustomFieldValuePresent(entry));
  }

  return true;
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
