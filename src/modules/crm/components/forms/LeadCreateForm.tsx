import type { CustomFieldDefinition, JobType, LeadStatus, Service, UserProfile } from "@/modules/crm/types";
import { leadStatuses } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DynamicCustomFields } from "@/modules/crm/components/forms/DynamicCustomFields";

export function LeadCreateForm({
  services,
  jobTypes,
  users,
  customFields,
}: {
  services: Service[];
  jobTypes: JobType[];
  users: UserProfile[];
  customFields: CustomFieldDefinition[];
}) {
  return (
    <ApiForm endpoint="/api/crm/leads" submitLabel="Create Lead" className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <select name="status" defaultValue={"new" as LeadStatus} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {leadStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Source</span>
          <input name="source" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Google Ads, referral, Meta…" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span>
          <select name="service_id" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select…</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Job Type</span>
          <select name="job_type_id" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select…</option>
            {jobTypes.map((jobType) => (
              <option key={jobType.id} value={jobType.id}>
                {jobType.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</span>
          <select name="assigned_to" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.user_id} value={user.user_id}>
                {user.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Next Action</span>
          <input name="next_action_at" type="datetime-local" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Problem Description</span>
          <textarea
            name="problem_description"
            className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Customer's words"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Affected Area</span>
          <input name="affected_area" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Kitchen, bathroom, outside…" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Urgency</span>
          <select name="urgency_level" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select…</option>
            <option value="emergency">Emergency</option>
            <option value="same_day">Same day</option>
            <option value="flexible">Flexible</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred Date</span>
          <input name="preferred_date_text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Tomorrow morning, Fri 10 Apr…" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred Time Window</span>
          <input name="preferred_time_window" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="AM, 9-12, after 3pm…" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span>
        <textarea name="notes" className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <DynamicCustomFields definitions={customFields} entityType="lead" />
    </ApiForm>
  );
}
