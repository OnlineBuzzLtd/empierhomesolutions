import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import type { Site } from "@/modules/crm/types";

export function SiteCreateForm({ customerId, site }: { customerId: string; site?: Site }) {
  return (
    <ApiForm
      endpoint={site ? `/api/crm/sites/${site.id}` : "/api/crm/sites"}
      method={site ? "PATCH" : "POST"}
      submitLabel={site ? "Save Site" : "Add Site"}
      className="space-y-3"
    >
      {!site ? <input type="hidden" name="customer_id" value={customerId} /> : null}
      {(
        [
          ["label", "Site name", "e.g. Home, Rental property"],
          ["address_line1", "Address line 1", ""],
          ["address_line2", "Address line 2", ""],
          ["city", "Town / city", ""],
          ["postcode", "Postcode", ""],
        ] as const
      ).map(([name, label, placeholder]) => (
        <label key={name} className="grid gap-1 text-sm text-slate-700">
          {label}
          <input
            name={name}
            defaultValue={site?.[name] ?? ""}
            required={name === "label"}
            maxLength={name === "postcode" ? 16 : name === "label" || name === "city" ? 120 : 250}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      ))}
      {(
        [
          ["access_notes", "Access notes"],
          ["parking_notes", "Parking notes"],
        ] as const
      ).map(([name, label]) => (
        <label key={name} className="grid gap-1 text-sm text-slate-700">
          {label}
          <textarea
            name={name}
            defaultValue={site?.[name] ?? ""}
            maxLength={4000}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      ))}
      {!site ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_primary" /> Make this the primary site
        </label>
      ) : null}
    </ApiForm>
  );
}
