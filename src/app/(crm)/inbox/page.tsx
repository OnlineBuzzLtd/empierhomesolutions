import Link from "next/link";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { getAddonState } from "@/modules/crm/lib/addons";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { PlatformConversationList } from "@/modules/platform/components/PlatformConversationList";
import { PlatformTimeline } from "@/modules/platform/components/PlatformTimeline";
import { buildPlatformE2eInboxFixtures } from "@/modules/platform/lib/e2e-fixtures";
import { humanizePlatformKey } from "@/modules/platform/lib/presenter";
import { getPlatformWorkspaceOverview, listPlatformConversationRecords } from "@/modules/platform/lib/repository";
import { listReviewablePlatformConversationRecords } from "@/modules/platform/lib/review";
import { buildWorkspaceModuleCards, toWorkspaceId } from "@/modules/platform/lib/workspace";

export default async function InboxPage() {
  const env = getCrmEnv();
  const [session, addon] = await Promise.all([requireCrmUser(), getAddonState("ai_comms_hub")]);
  const fixtures = env.crmE2ePlatformFixturesEnabled ? buildPlatformE2eInboxFixtures() : null;
  const supabase = fixtures ? null : await createCrmServerClient();
  const overview = fixtures
    ? fixtures.overview
    : session.tenant && supabase
      ? await getPlatformWorkspaceOverview(supabase, session.tenant.id)
      : null;
  const conversationRecords = fixtures
    ? fixtures.conversationRecords
    : session.tenant && supabase
      ? await listPlatformConversationRecords(supabase, session.tenant.id, 8)
      : [];
  const workspaceId = overview?.alias?.workspace_id ?? (session.tenant ? toWorkspaceId(session.tenant.id) : "unconfigured");
  const modules = buildWorkspaceModuleCards();
  const linkedCustomers = conversationRecords.filter((record) => record.customer !== null).length;
  const linkedJobs = conversationRecords.filter((record) => record.job !== null).length;
  const bookedAppointments = conversationRecords.filter((record) => record.bookingAppointment !== null).length;
  const reviewRecords = listReviewablePlatformConversationRecords(conversationRecords);
  const currentUser = session.user
    ? {
        id: session.user.id,
        name: session.profile?.full_name ?? session.user.email ?? "CRM User",
      }
    : undefined;
  const timelineItems =
    overview === null
      ? []
      : [...overview.events.map((event) => ({
          id: `event:${event.envelope.event_id}`,
          title: humanizePlatformKey(event.envelope.event_type),
          detail: `${humanizePlatformKey(event.envelope.aggregate.type)} activity recorded from ${humanizePlatformKey(event.envelope.source_system)}.`,
          timestamp: event.envelope.occurred_at,
          status: event.processing_status,
          meta: `Event ID ${event.envelope.event_id}`,
        })),
        ...overview.commands.map((command) => ({
          id: `command:${command.envelope.command_id}`,
          title: humanizePlatformKey(command.envelope.command_type),
          detail: `Command queued for ${humanizePlatformKey(command.envelope.target_system)} against ${humanizePlatformKey(command.envelope.aggregate.type)}.`,
          timestamp: command.envelope.issued_at,
          status: command.delivery_status,
          meta: `Command ID ${command.envelope.command_id}`,
        }))]
          .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
          .slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace Operator Surface</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Inbox</h1>
        <p className="mt-1 text-sm text-slate-500">
          One workspace queue for conversations, missed-call recovery, and linked CRM outcomes.
        </p>
      </div>

      <SectionCard
        title="Workspace Context"
        action={
          !addon.enabled ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              Add-on
            </span>
          ) : null
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <InfoStat label="Workspace ID" value={workspaceId} />
          <InfoStat label="Business" value={session.tenant?.name ?? "Unknown"} />
          <InfoStat label="Shell" value="CRM-owned operator shell" />
        </div>
      </SectionCard>

      <SectionCard title="Live Workspace Counters">
        <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
          <InfoStat label="Events" value={String(overview?.stats.eventCount ?? 0)} />
          <InfoStat label="Commands" value={String(overview?.stats.commandCount ?? 0)} />
          <InfoStat label="Pending Commands" value={String(overview?.stats.pendingCommands ?? 0)} />
          <InfoStat label="Open Failures" value={String(overview?.stats.openFailures ?? 0)} />
          <InfoStat label="Linked Customers" value={String(linkedCustomers)} />
          <InfoStat label="Linked Jobs" value={String(linkedJobs)} />
          <InfoStat label="Booked Visits" value={String(bookedAppointments)} />
          <InfoStat label="Needs Review" value={String(reviewRecords.length)} />
        </div>
      </SectionCard>

      <SectionCard title="Native AI Modules">
        <div className="grid gap-4 lg:grid-cols-2">
          {modules.map((module) => (
            <Link key={module.href} href={module.href} className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
              <p className="text-sm font-semibold text-slate-900">{module.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{module.summary}</p>
              <ul className="mt-3 space-y-1 text-xs text-slate-500">
                {module.bullets.map((bullet) => (
                  <li key={bullet}>• {bullet}</li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Conversation-to-Job Timeline">
        <PlatformTimeline
          items={timelineItems}
          emptyMessage="No platform activity has been recorded for this workspace yet."
        />
      </SectionCard>

      <SectionCard title="Needs Review Queue">
        <PlatformConversationList
          records={reviewRecords}
          emptyMessage="No unresolved conversation links currently need operator review."
          currentUser={currentUser}
        />
      </SectionCard>

      <SectionCard title="Recent Linked Conversations">
        <PlatformConversationList
          records={conversationRecords}
          emptyMessage="No linked conversations have been materialised into CRM records yet."
          currentUser={currentUser}
        />
      </SectionCard>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-all text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
