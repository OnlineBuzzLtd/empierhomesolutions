import type { JobType, Service } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";

export function RequiredDocumentRuleForm({ services, jobTypes }: { services: Service[]; jobTypes: JobType[] }) {
  return (
    <ApiForm endpoint="/api/crm/settings/document-rules" submitLabel="Save Rule" className="grid gap-3 md:grid-cols-2">
      <select name="entity_type" defaultValue="job" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="job">Job</option>
        <option value="lead">Lead</option>
        <option value="asset">Asset</option>
      </select>
      <input name="document_type" required placeholder="certificate, compliance, image…" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="pipeline_stage" placeholder="Stage/status" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="due_within_days" type="number" min="0" placeholder="Due within days" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
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
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="required" type="checkbox" defaultChecked />
        Required
      </label>
    </ApiForm>
  );
}
