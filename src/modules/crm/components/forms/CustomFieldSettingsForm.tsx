import type { JobType, Service } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";

export function CustomFieldSettingsForm({ services, jobTypes }: { services: Service[]; jobTypes: JobType[] }) {
  return (
    <ApiForm endpoint="/api/crm/settings/custom-fields" submitLabel="Save Custom Field" className="grid gap-3 md:grid-cols-2">
      <select name="entity_type" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="lead">Lead</option>
        <option value="customer">Customer</option>
        <option value="job">Job</option>
        <option value="asset">Asset</option>
        <option value="quote">Quote</option>
        <option value="invoice">Invoice</option>
      </select>
      <input name="label" required placeholder="Label" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="field_key" required placeholder="field_key" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <select name="field_type" defaultValue="text" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="text">Text</option>
        <option value="textarea">Textarea</option>
        <option value="number">Number</option>
        <option value="select">Select</option>
        <option value="date">Date</option>
        <option value="boolean">Boolean</option>
      </select>
      <select name="service_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="">All services</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </select>
      <select name="job_type_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="">All job types</option>
        {jobTypes.map((jobType) => (
          <option key={jobType.id} value={jobType.id}>
            {jobType.name}
          </option>
        ))}
      </select>
      <input name="options_csv" placeholder="Option A, Option B" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="required" type="checkbox" />
        Required
      </label>
    </ApiForm>
  );
}
