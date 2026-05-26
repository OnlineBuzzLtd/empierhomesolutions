import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import type { Site } from "@/modules/crm/types";

export function SiteContactCreateForm({ sites }: { sites: Site[] }) {
  if (sites.length === 0) {
    return <p className="text-sm text-slate-500">Add a site before creating site contacts.</p>;
  }

  return (
    <ApiForm endpoint="/api/crm/site-contacts" submitLabel="Add Site Contact" className="space-y-3">
      <select name="site_id" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.label}
          </option>
        ))}
      </select>
      <input
        name="full_name"
        required
        placeholder="Contact name"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        name="phone"
        placeholder="Phone"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        name="role_label"
        placeholder="Role, e.g. Facilities manager"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_primary" className="h-4 w-4" />
        <span>Primary contact for this site</span>
      </label>
    </ApiForm>
  );
}
