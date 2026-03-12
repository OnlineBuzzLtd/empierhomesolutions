import type { CustomFieldDefinition, Customer, JobType, Service } from "@/modules/crm/types";
import { jobStatuses } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DynamicCustomFields } from "@/modules/crm/components/forms/DynamicCustomFields";

export function JobCreateForm({
  customers,
  services,
  jobTypes,
  customFields,
}: {
  customers: Customer[];
  services: Service[];
  jobTypes: JobType[];
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
        <input name="assigned_engineer" placeholder="Assigned engineer" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="scheduled_date" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="scheduled_time" type="time" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <textarea name="description" placeholder="Description" className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <DynamicCustomFields definitions={customFields} entityType="job" />
    </ApiForm>
  );
}
