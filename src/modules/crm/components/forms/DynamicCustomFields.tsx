import type { CustomFieldDefinition } from "@/modules/crm/types";

export function DynamicCustomFields({
  definitions,
  entityType,
}: {
  definitions: CustomFieldDefinition[];
  entityType: CustomFieldDefinition["entity_type"];
}) {
  const fields = definitions.filter((definition) => definition.entity_type === entityType);

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => {
        const inputName = `custom_field_${field.id}`;

        if (field.field_type === "textarea") {
          return (
            <label key={field.id} className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</span>
              <textarea name={inputName} required={field.required} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
          );
        }

        if (field.field_type === "select") {
          return (
            <label key={field.id} className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</span>
              <select name={inputName} required={field.required} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <label key={field.id} className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</span>
            <input
              name={inputName}
              required={field.required}
              type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        );
      })}
    </div>
  );
}
