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
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="ai_visible" type="checkbox" defaultChecked />
        AI can see
      </label>
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="ai_bookable" type="checkbox" defaultChecked />
        AI can book
      </label>
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="ai_price_enabled" type="checkbox" />
        AI may mention price
      </label>
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <input name="ai_requires_office_quote" type="checkbox" defaultChecked />
        Office confirms quote
      </label>
      <input
        name="ai_default_duration_minutes"
        type="number"
        min="1"
        placeholder="AI duration minutes"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        name="ai_price_disclaimer"
        placeholder="AI price disclaimer"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </ApiForm>
  );
}
