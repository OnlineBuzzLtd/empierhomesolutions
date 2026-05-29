import { notFound } from "next/navigation";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

export default async function FsmSettingsPage() {
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
  const config = (settings?.fsm_config ?? {}) as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">FSM Integration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select the tenant field-service system used for booking handoff.
        </p>
      </div>

      <SectionCard title="Provider">
        <ApiForm endpoint="/api/crm/settings/fsm" submitLabel="Save FSM Settings" className="grid gap-3">
          <select
            name="fsm_provider"
            defaultValue={String(settings?.fsm_provider ?? "none")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="none">None</option>
            <option value="servicem8">ServiceM8</option>
            <option value="joblogic">Joblogic</option>
          </select>
          <input
            name="api_key"
            defaultValue={typeof config.api_key === "string" ? config.api_key : ""}
            placeholder="API key"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="account_id"
            defaultValue={typeof config.account_id === "string" ? config.account_id : ""}
            placeholder="Account ID"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="base_url"
            defaultValue={typeof config.base_url === "string" ? config.base_url : ""}
            placeholder="Base URL"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </ApiForm>
      </SectionCard>
    </div>
  );
}
