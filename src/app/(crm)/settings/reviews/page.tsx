import { notFound } from "next/navigation";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

export default async function ReviewSettingsPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireSettingsAccess();
  if (!session.user || !session.tenant) {
    notFound();
  }

  const supabase = await createCrmServerClient();
  const { data: settings } = await supabase
    .schema("crm")
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review Requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure the public review destination for this tenant.
        </p>
      </div>

      <SectionCard title="Review Platform">
        <ApiForm
          endpoint="/api/crm/settings/reviews"
          submitLabel="Save Review Settings"
          className="grid gap-3"
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="review_requests_enabled"
              defaultChecked={Boolean(settings?.review_requests_enabled)}
            />
            <span>Send post-job review requests after completion</span>
          </label>
          <select
            name="review_primary_platform"
            defaultValue={String(settings?.review_primary_platform ?? "none")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="none">None</option>
            <option value="google">Google</option>
            <option value="trustpilot">Trustpilot</option>
            <option value="facebook">Facebook</option>
          </select>
          <input
            name="review_google_place_id"
            defaultValue={String(settings?.review_google_place_id ?? "")}
            placeholder="Google Place ID"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="review_trustpilot_url"
            defaultValue={String(settings?.review_trustpilot_url ?? "")}
            placeholder="Trustpilot review URL"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="review_facebook_url"
            defaultValue={String(settings?.review_facebook_url ?? "")}
            placeholder="Facebook review URL"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </ApiForm>
      </SectionCard>
    </div>
  );
}
