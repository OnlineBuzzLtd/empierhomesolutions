import type { Customer, CustomFieldDefinition, JobType, LeadStatus, Service, UserProfile } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DynamicCustomFields } from "@/modules/crm/components/forms/DynamicCustomFields";
import { LeadCustomerMatchFields } from "@/modules/crm/components/forms/LeadCustomerMatchFields";

export function LeadCreateForm({
  customers = [],
  services,
  jobTypes,
  users,
  customFields,
  successRedirectHref,
}: {
  customers?: Customer[];
  services: Service[];
  jobTypes: JobType[];
  users: UserProfile[];
  customFields: CustomFieldDefinition[];
  successRedirectHref?: string;
}) {
  return (
    <ApiForm
      endpoint="/api/crm/leads"
      submitLabel="Create Enquiry"
      className="space-y-3"
      invalidatePaths={["/api/crm/leads", "/api/crm/dashboard/summary"]}
      redirectOnSuccess={successRedirectHref}
    >
      <input type="hidden" name="status" value={"new" as LeadStatus} />

      <div className="space-y-4">
        <LeadCustomerMatchFields customers={customers} />

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Problem</span>
          <textarea
            name="problem_description"
            className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Write the customer's words. Example: Boiler losing pressure, needs help today."
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Urgency</span>
            <select name="urgency_level" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Not sure yet</option>
              <option value="emergency">Emergency</option>
              <option value="same_day">Same day</option>
              <option value="flexible">Flexible</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred time</span>
            <input name="preferred_time_window" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="AM, 9-12, after 3pm..." />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone note</span>
          <textarea
            name="notes"
            className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Customer name, phone, access notes, or anything the office needs to remember."
          />
        </label>
      </div>

      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">More details</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Source</span>
            <input name="source" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Google Ads, referral, Meta..." />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred date</span>
            <input name="preferred_date_text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Tomorrow morning, Friday..." />
          </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span>
          <select name="service_id" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select...</option>
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
            <option value="">Select...</option>
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
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Affected Area</span>
          <input name="affected_area" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Kitchen, bathroom, outside..." />
        </label>
          <div className="md:col-span-2">
            <DynamicCustomFields definitions={customFields} entityType="lead" />
          </div>
      </div>
      </details>
    </ApiForm>
  );
}
