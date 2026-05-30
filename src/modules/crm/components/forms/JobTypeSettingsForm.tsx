import type { Service } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";

export function JobTypeSettingsForm({ services }: { services: Service[] }) {
  return (
    <ApiForm endpoint="/api/crm/settings/services" submitLabel="Save Job Type" className="grid gap-3 md:grid-cols-2">
      <input name="kind" type="hidden" value="job_type" />
      <select name="service_id" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="">Select service…</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </select>
      <input name="name" required placeholder="Job type name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="slug" required placeholder="job-type-slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="description" placeholder="Description" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="active" type="checkbox" defaultChecked />
        Active
      </label>
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="ai_visible" type="checkbox" defaultChecked />
        AI can see
      </label>
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="ai_bookable" type="checkbox" defaultChecked />
        AI can book
      </label>
      <input
        name="ai_default_duration_minutes"
        type="number"
        min="1"
        placeholder="AI duration minutes"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </ApiForm>
  );
}
