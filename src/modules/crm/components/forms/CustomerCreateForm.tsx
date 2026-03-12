import type { CustomFieldDefinition } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DynamicCustomFields } from "@/modules/crm/components/forms/DynamicCustomFields";

export function CustomerCreateForm({ customFields }: { customFields: CustomFieldDefinition[] }) {
  return (
    <ApiForm endpoint="/api/crm/customers" submitLabel="Create Customer" className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <input name="full_name" required placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="email" type="email" placeholder="Email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="postcode" placeholder="Postcode" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="address_line1" placeholder="Address line 1" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="city" placeholder="City" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="property_type" placeholder="Property type" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="occupancy_type" placeholder="Tenant / landlord / homeowner" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="source" placeholder="Lead source" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
      </div>
      <textarea name="notes" placeholder="Notes" className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <DynamicCustomFields definitions={customFields} entityType="customer" />
    </ApiForm>
  );
}
