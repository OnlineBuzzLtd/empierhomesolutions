"use client";

import { useRouter } from "next/navigation";
import type { CustomFieldDefinition } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DynamicCustomFields } from "@/modules/crm/components/forms/DynamicCustomFields";

function getResponseId(value: unknown) {
  if (!value || typeof value !== "object" || !("id" in value)) {
    return null;
  }

  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function CustomerCreateForm({ customFields }: { customFields: CustomFieldDefinition[] }) {
  const router = useRouter();

  return (
    <ApiForm
      endpoint="/api/crm/customers"
      submitLabel="Create Customer"
      className="space-y-3"
      refreshOnSuccess={false}
      successMessage="Customer created. Opening job form..."
      onSuccess={(result) => {
        const customerId = getResponseId(result.customer);
        if (!customerId) {
          router.refresh();
          return;
        }

        const params = new URLSearchParams({ customer: customerId });
        const siteId = getResponseId(result.site);
        const siteContactId = getResponseId(result.site_contact);
        if (siteId) {
          params.set("site", siteId);
        }
        if (siteContactId) {
          params.set("siteContact", siteContactId);
        }

        router.push(`/jobs?${params.toString()}`);
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="first_name"
          required
          placeholder="First name"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="last_name"
          placeholder="Last name"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="phone"
          placeholder="Phone"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="postcode"
          placeholder="Postcode"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="address_line1"
          placeholder="Address line 1"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="city"
          placeholder="City"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="property_type"
          placeholder="Property type"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="occupancy_type"
          placeholder="Tenant / landlord / homeowner"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="source"
          placeholder="Lead source"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
      </div>
      <textarea
        name="notes"
        placeholder="Notes"
        className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Primary site</p>
        <p className="mt-1 text-xs text-slate-500">
          Create a structured site record now so future jobs can target the correct property and contact.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            name="site_label"
            placeholder="Site label"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="site_postcode"
            placeholder="Site postcode"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="site_address_line1"
            placeholder="Site address line 1"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="site_address_line2"
            placeholder="Site address line 2"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="site_city"
            placeholder="Site city"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="site_contact_full_name"
            placeholder="Site contact name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="site_contact_phone"
            placeholder="Site contact phone"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="site_contact_email"
            type="email"
            placeholder="Site contact email"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="site_contact_role"
            placeholder="Site contact role"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" name="site_vulnerable_occupant_flag" value="true" className="h-4 w-4" />
            <span>Vulnerable occupant at site</span>
          </label>
          <textarea
            name="site_access_notes"
            placeholder="Access notes"
            className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            name="site_parking_notes"
            placeholder="Parking notes"
            className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <DynamicCustomFields definitions={customFields} entityType="customer" />
    </ApiForm>
  );
}
