import { ApiForm } from "@/modules/crm/components/forms/ApiForm";

export function ServiceSettingsForm() {
  return (
    <ApiForm endpoint="/api/crm/settings/services" submitLabel="Save Service" className="grid gap-3 md:grid-cols-2">
      <input name="kind" type="hidden" value="service" />
      <input name="name" required placeholder="Service name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="slug" required placeholder="service-slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="launch_date" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="active" type="checkbox" defaultChecked />
        Active
      </label>
    </ApiForm>
  );
}
