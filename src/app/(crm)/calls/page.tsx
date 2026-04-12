import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { getAddonState } from "@/modules/crm/lib/addons";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { PlatformConversationList } from "@/modules/platform/components/PlatformConversationList";
import { PlatformTimeline } from "@/modules/platform/components/PlatformTimeline";
import { humanizePlatformKey } from "@/modules/platform/lib/presenter";
import { getPlatformWorkspaceOverview, listPlatformConversationRecords } from "@/modules/platform/lib/repository";
import { listReviewablePlatformConversationRecords } from "@/modules/platform/lib/review";

const recoveryStages = [
  "Missed call captured",
  "Recovery SMS queued",
  "Customer reply received",
  "Conversation qualified",
  "Callback or booking created",
] as const;

export default async function CallsPage() {
  const [session, addon, supabase] = await Promise.all([requireCrmUser(), getAddonState("ai_comms_hub"), createCrmServerClient()]);
  const overview = session.tenant ? await getPlatformWorkspaceOverview(supabase, session.tenant.id) : null;
  const conversationRecords = session.tenant ? await listPlatformConversationRecords(supabase, session.tenant.id, 12) : [];
  const missedCalls = overview ? overview.events.filter((event) => event.envelope.event_type === "MissedCallCaptured") : [];
  const callbackCommands = overview ? overview.commands.filter((command) => command.envelope.command_type === "CreateCallbackTask") : [];
  const voiceConversationRecords = conversationRecords.filter(
    (record) => record.link.latest_channel === "voice" || record.callbackAppointment !== null,
  );
  const reviewableRecoveries = listReviewablePlatformConversationRecords(voiceConversationRecords);
  const recoveredCustomers = voiceConversationRecords.filter((record) => record.customer !== null).length;
  const bookedRecoveries = voiceConversationRecords.filter((record) => record.bookingAppointment !== null).length;
  const unresolvedRecoveries = reviewableRecoveries.length;
  const currentUser = session.user
    ? {
        id: session.user.id,
        name: session.profile?.full_name ?? session.user.email ?? "CRM User",
      }
    : undefined;
  const callItems = [...missedCalls.map((event) => ({
    id: event.envelope.event_id,
    title: "Missed Call Captured",
    detail: `Voice-originated demand captured from ${humanizePlatformKey(event.envelope.source_system)}.`,
    timestamp: event.envelope.occurred_at,
    status: event.processing_status,
    meta: `Idempotency ${event.envelope.idempotency_key}`,
  })), ...callbackCommands.map((command) => ({
    id: command.envelope.command_id,
    title: "Callback Task Command",
    detail: `Callback or recovery work queued inside the CRM workspace.`,
    timestamp: command.envelope.issued_at,
    status: command.delivery_status,
    meta: command.last_error ?? `Attempt count ${command.attempt_count}`,
  }))].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI Comms Operations</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Calls & Missed Call Recovery</h1>
        <p className="mt-1 text-sm text-slate-500">
          Workspace-safe view of voice-originated demand and the recovery flow that moves it into CRM action.
        </p>
      </div>

      <SectionCard
        title="Why this module exists"
        action={
          !addon.enabled ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              Add-on
            </span>
          ) : null
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          {session.tenant?.name ?? "This workspace"} should be able to see missed-call capture, callback handling, and recovery outcomes inside the same product shell instead of treating voice events as an external black box.
        </p>
      </SectionCard>

      <SectionCard title="Live Recovery Metrics">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Missed Calls Logged" value={String(missedCalls.length)} />
          <Metric label="Recovered Customers" value={String(recoveredCustomers)} />
          <Metric label="Booked Recoveries" value={String(bookedRecoveries)} />
          <Metric label="Unresolved Recovery Cases" value={String(unresolvedRecoveries)} />
        </div>
      </SectionCard>

      <SectionCard title="Recovery Stages">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {recoveryStages.map((stage, index) => (
            <div key={stage} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage {index + 1}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{stage}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recent Recovery Outcomes">
        <PlatformConversationList
          records={voiceConversationRecords}
          emptyMessage="No voice recovery conversations have been linked into CRM records yet."
          currentUser={currentUser}
        />
      </SectionCard>

      <SectionCard title="Recovery Review Queue">
        <PlatformConversationList
          records={reviewableRecoveries}
          emptyMessage="No voice recovery conversations currently need operator review."
          currentUser={currentUser}
        />
      </SectionCard>

      <SectionCard title="Recent Call Recovery Activity">
        <PlatformTimeline
          items={callItems}
          emptyMessage="No missed-call recovery activity has been logged for this workspace yet."
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
