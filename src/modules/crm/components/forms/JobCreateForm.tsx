import type { CustomFieldDefinition, Customer, JobType, Service, Site, SiteContact } from "@/modules/crm/types";
import { jobStatuses } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DynamicCustomFields } from "@/modules/crm/components/forms/DynamicCustomFields";

export function JobCreateForm({
  customers,
  services,
  jobTypes,
  sites = [],
  siteContacts = [],
  engineers = [],
  customFields,
}: {
  customers: Customer[];
  services: Service[];
  jobTypes: JobType[];
  sites: Array<Site & { customer?: Pick<Customer, "id" | "full_name"> | null }>;
  siteContacts: Array<SiteContact & { site?: Pick<Site, "id" | "label" | "customer_id"> | null }>;
  engineers: Array<{ id: string; full_name: string }>;
  customFields: CustomFieldDefinition[];
}) {
  return (
    <ApiForm endpoint="/api/crm/jobs" submitLabel="Create Job" className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <select name="customer_id" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Select customer…</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.full_name}
            </option>
          ))}
        </select>
        <input name="title" required placeholder="Job title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select name="site_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Primary / default customer site</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.customer?.full_name ?? "Customer"} · {site.label}
            </option>
          ))}
        </select>
        <select name="site_contact_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">No specific site contact</option>
          {siteContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.full_name} · {contact.site?.label ?? "Site"}
            </option>
          ))}
        </select>
        <select name="service_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Select service…</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
        <select name="job_type_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Select job type…</option>
          {jobTypes.map((jobType) => (
            <option key={jobType.id} value={jobType.id}>
              {jobType.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue="enquiry" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {jobStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input name="scheduled_date" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="scheduled_time" type="time" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <input type="hidden" name="assigned_engineer_ids" value="" />
        <p className="text-sm font-semibold text-slate-900">Assigned engineers</p>
        <p className="mt-1 text-xs text-slate-500">Select one or more operatives for this job.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {engineers.length === 0 ? <p className="text-sm text-slate-500">No active engineers available.</p> : null}
          {engineers.map((engineer) => (
            <label key={engineer.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" name="assigned_engineer_ids" value={engineer.id} className="h-4 w-4" />
              <span>{engineer.full_name}</span>
            </label>
          ))}
        </div>
      </div>
      <textarea name="description" placeholder="Description" className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <DynamicCustomFields definitions={customFields} entityType="job" />
    </ApiForm>
  );
}
