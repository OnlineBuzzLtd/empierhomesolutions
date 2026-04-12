import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { getAddonState } from "@/modules/crm/lib/addons";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { PlatformTimeline } from "@/modules/platform/components/PlatformTimeline";
import { platformEventTypes } from "@/modules/platform/contracts";
import { humanizePlatformKey } from "@/modules/platform/lib/presenter";
import { getPlatformWorkspaceOverview } from "@/modules/platform/lib/repository";

export default async function AutomationsPage() {
  const [session, addon, supabase] = await Promise.all([requireCrmUser(), getAddonState("ai_comms_hub"), createCrmServerClient()]);
  const overview = session.tenant ? await getPlatformWorkspaceOverview(supabase, session.tenant.id) : null;
  const deliveryUpdates = overview ? overview.events.filter((event) => event.envelope.event_type === "DeliveryStatusUpdated").length : 0;
  const recoveryEvents = overview ? overview.events.filter((event) => event.envelope.event_type === "MissedCallCaptured").length : 0;
  const automationItems = overview
    ? [...overview.commands.map((command) => ({
        id: command.envelope.command_id,
        title: humanizePlatformKey(command.envelope.command_type),
        detail: `Target ${humanizePlatformKey(command.envelope.target_system)}. Attempts: ${command.attempt_count}.`,
        timestamp: command.envelope.issued_at,
        status: command.delivery_status,
        meta: command.last_error ?? `Correlation ${command.envelope.correlation_id ?? "not set"}`,
      })), ...overview.events
        .filter((event) => event.envelope.event_type === "AutomationDispatched" || event.envelope.event_type === "DeliveryStatusUpdated")
        .map((event) => ({
          id: event.envelope.event_id,
          title: humanizePlatformKey(event.envelope.event_type),
          detail: `Event from ${humanizePlatformKey(event.envelope.source_system)} for ${humanizePlatformKey(event.envelope.aggregate.type)}.`,
          timestamp: event.envelope.occurred_at,
          status: event.processing_status,
          meta: event.last_error ?? `Idempotency ${event.envelope.idempotency_key}`,
        }))].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Durable Event Layer</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Automations</h1>
        <p className="mt-1 text-sm text-slate-500">
          The SaaS-ready automation surface is built around workspace-scoped events, idempotency, and replayable delivery.
        </p>
      </div>

      <SectionCard
        title="Operator Outcome"
        action={
          !addon.enabled ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              Add-on
            </span>
          ) : null
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          This module is where reminder dispatches, missed-call recovery, escalation notices, and delivery failures become visible and auditable at workspace level.
        </p>
      </SectionCard>

      <SectionCard title="Workspace Automation State">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Queued Commands" value={String(overview?.stats.pendingCommands ?? 0)} />
          <Metric label="Failures" value={String(overview?.stats.openFailures ?? 0)} />
          <Metric label="Delivery Updates" value={String(deliveryUpdates)} />
          <Metric label="Recovery Events" value={String(recoveryEvents)} />
        </div>
      </SectionCard>

      <SectionCard title="Shared Event Vocabulary">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {platformEventTypes.map((eventType) => (
            <div key={eventType} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
              {eventType}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recent Dispatch and Delivery Activity">
        <PlatformTimeline
          items={automationItems}
          emptyMessage="No automation dispatches or delivery updates have been logged for this workspace yet."
        />
      </SectionCard>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
