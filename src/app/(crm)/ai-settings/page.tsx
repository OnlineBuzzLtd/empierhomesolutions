import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { getAddonState } from "@/modules/crm/lib/addons";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { getPlatformWorkspaceOverview } from "@/modules/platform/lib/repository";

const settingsAreas = [
  "Prompt policy and handoff rules",
  "Booking and callback behaviour",
  "Quiet hours and channel gating",
  "Escalation targets and on-call routing",
  "Workspace feature flags",
] as const;

export default async function AiSettingsPage() {
  const [session, addon, supabase] = await Promise.all([requireCrmUser(), getAddonState("ai_comms_hub"), createCrmServerClient()]);
  const overview = session.tenant ? await getPlatformWorkspaceOverview(supabase, session.tenant.id) : null;
  const settingsChanges = overview ? overview.events.filter((event) => event.envelope.event_type === "WorkspaceSettingsChanged").length : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace Controls</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">AI Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          {session.tenant?.name ?? "This workspace"} owns its own AI policy, routing, and comms controls.
        </p>
      </div>

      <SectionCard
        title="Why this matters"
        action={
          !addon.enabled ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              Add-on
            </span>
          ) : null
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          SaaS-ready AI settings must be workspace-owned. The platform should never depend on hidden global defaults for routing, prompts, business hours, or escalation.
        </p>
      </SectionCard>

      <SectionCard title="Workspace Ownership">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Workspace ID" value={overview?.alias?.workspace_id ?? session.tenant?.id ?? "Unknown"} />
          <Metric label="Config Change Events" value={String(settingsChanges)} />
          <Metric label="Pending Commands" value={String(overview?.stats.pendingCommands ?? 0)} />
        </div>
      </SectionCard>

      <SectionCard title="Control Areas">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {settingsAreas.map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-all text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
