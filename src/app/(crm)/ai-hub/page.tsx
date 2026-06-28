import { redirect } from "next/navigation";
import { BookingRecoveryPanel } from "@/modules/crm/components/ai-hub/BookingRecoveryPanel";
import { LiveFrontDeskTester } from "@/modules/crm/components/ai-hub/LiveFrontDeskTester";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { canAccessLiveFrontDeskTester } from "@/modules/crm/lib/ai-hub-live";
import { listCustomers, listJobs } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import {
  loadChannelTestRuntimeSnapshot,
  type ChannelTestRuntimeSnapshot,
  type CustomerJourneysChannelStatus,
} from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { summarizeAiBusinessOutcomes, summarizeAiReviewQueue } from "@/modules/crm/lib/ai-review-queue";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { getPlatformConversationReviewState } from "@/modules/platform/lib/review";
import type { PlatformConversationRecord } from "@/modules/platform/lib/repository";
import { listBookingRecoveryCases, type BookingRecoveryCase } from "@/modules/platform/lib/booking-recovery";
import type { Customer, JobWithRelations } from "@/modules/crm/types";

const aiHubTabs = [
  { id: "overview", label: "Overview" },
  { id: "needs-review", label: "Needs review" },
  { id: "conversations", label: "Conversations" },
  { id: "bookings", label: "Bookings" },
  { id: "channels", label: "Channels" },
  { id: "test", label: "Test" },
  { id: "settings", label: "Settings" },
] as const;

type AiHubTab = (typeof aiHubTabs)[number]["id"];
type SearchParams = Record<string, string | string[] | undefined>;

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeAiHubTab(value: string | undefined): AiHubTab {
  return aiHubTabs.some((tab) => tab.id === value) ? (value as AiHubTab) : "overview";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRuntimeMode(mode: ChannelTestRuntimeSnapshot["runtime"] extends infer Runtime ? Runtime extends { runtimeMode: infer Mode } ? Mode : never : never) {
  return mode === "legacy_fallback" ? "Backup responder" : mode === "platform_ai" ? "AI connected" : "Unknown";
}

function formatChannelLabel(channel: string) {
  if (channel === "webchat") return "Web chat";
  if (channel === "sms") return "SMS";
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "voice") return "Phone";
  return "Unknown";
}

function formatConversationChannel(value: string | null) {
  return value ? formatChannelLabel(value) : "Unknown";
}

function isToday(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function latestEventAt(records: PlatformConversationRecord[]) {
  return records
    .map((record) => record.link.latest_event_at)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function recordTitle(record: PlatformConversationRecord) {
  return record.customer?.full_name ?? record.job?.title ?? record.bookingAppointment?.title ?? "Conversation needs linking";
}

function recordMeta(record: PlatformConversationRecord) {
  return [
    record.lead?.status ? `Enquiry ${record.lead.status}` : null,
    record.job?.status ? `Job ${record.job.status}` : null,
    record.bookingAppointment ? `Booking ${formatDateTime(record.bookingAppointment.starts_at)}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function channelCards(snapshot: ChannelTestRuntimeSnapshot) {
  const runtime = snapshot.runtime;
  if (!runtime) {
    return [] as Array<[string, CustomerJourneysChannelStatus]>;
  }

  return [
    ["webchat", runtime.channels.webchat],
    ["sms", runtime.channels.sms],
    ["whatsapp", runtime.channels.whatsapp],
    ["voice", runtime.channels.voice],
  ] as Array<[string, CustomerJourneysChannelStatus]>;
}

function frontDeskStatus(snapshot: ChannelTestRuntimeSnapshot, recoveryCases: BookingRecoveryCase[]) {
  if (!snapshot.runtimeConfigured || !snapshot.runtime) {
    return {
      label: "Needs setup",
      detail: "The AI receptionist is not ready to handle customers yet.",
      className: "bg-amber-100 text-amber-800",
    };
  }

  if (recoveryCases.length > 0) {
    return {
      label: "Needs review",
      detail: `${recoveryCases.length} AI booking ${recoveryCases.length === 1 ? "item needs" : "items need"} office review.`,
      className: "bg-amber-100 text-amber-800",
    };
  }

  if (snapshot.runtime.issues.length > 0) {
    return {
      label: "Check setup",
      detail: snapshot.runtime.issues.join(" "),
      className: "bg-amber-100 text-amber-800",
    };
  }

  return {
    label: snapshot.usingFixtures ? "Demo mode" : "Working",
    detail: snapshot.usingFixtures
      ? "Demo responses are active, so customer-facing channels are not fully live."
      : "The AI receptionist is connected and no review items are open.",
    className: snapshot.usingFixtures ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800",
  };
}

function readinessChecks(snapshot: ChannelTestRuntimeSnapshot, recoveryCases: BookingRecoveryCase[]) {
  const channels = channelCards(snapshot);
  const readyChannels = channels.filter(([, details]) => details.ready).length;
  return [
    {
      label: "AI system connection",
      ready: Boolean(snapshot.link?.customerjourneys_tenant_id && snapshot.runtimeConfigured),
      detail: snapshot.link?.customerjourneys_tenant_id ? "CRM is linked to the AI system." : "Connect the AI system before going live.",
      href: "/ai-settings",
    },
    {
      label: "Customer channels",
      ready: readyChannels > 0,
      detail: readyChannels > 0 ? `${readyChannels} customer channel${readyChannels === 1 ? "" : "s"} ready.` : "No live customer channel is ready.",
      href: "/ai-hub?tab=channels",
    },
    {
      label: "Booking resources",
      ready: Boolean(snapshot.runtime?.bookingResourceCount),
      detail: snapshot.runtime?.bookingResourceCount
        ? `${snapshot.runtime.bookingResourceCount} booking resource${snapshot.runtime.bookingResourceCount === 1 ? "" : "s"} available.`
        : "Add booking resources before allowing AI bookings.",
      href: "/ai-settings",
    },
    {
      label: "Calendar health",
      ready: Boolean(snapshot.runtime?.calendarHealth?.healthy),
      detail: snapshot.runtime?.calendarHealth?.healthy
        ? "Calendar connection is healthy."
        : snapshot.runtime?.calendarHealth?.lastError ?? "Calendar health needs checking.",
      href: "/ai-settings",
    },
    {
      label: "Review queue",
      ready: recoveryCases.length === 0,
      detail: recoveryCases.length === 0 ? "No AI booking recovery items are open." : `${recoveryCases.length} item${recoveryCases.length === 1 ? "" : "s"} need review.`,
      href: "/ai-hub?tab=needs-review",
    },
  ];
}

export default async function AiHubPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireCrmUser();
  if (!canAccessLiveFrontDeskTester({ tenantId: session.tenant?.id, role: session.profile?.role })) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const activeTab = normalizeAiHubTab(getSingleParam(params.tab));
  const conversationQuery = getSingleParam(params.q) ?? "";
  const selectedConversationId = getSingleParam(params.conversation) ?? null;
  const env = getCrmEnv();
  const demoState = await getCrmDemoState();
  const serviceRole = env.crmE2ePlatformFixturesEnabled ? ({} as never) : createCrmServiceRoleClient();
  const [initialSnapshot, recoveryCases, customers, jobs] = await Promise.all([
    loadChannelTestRuntimeSnapshot(serviceRole, session.tenant!.id),
    env.crmE2ePlatformFixturesEnabled ? Promise.resolve([]) : listBookingRecoveryCases(serviceRole, session.tenant!.id),
    env.crmE2ePlatformFixturesEnabled ? Promise.resolve([]) : listCustomers(demoState.mode, { pageSize: 250 }),
    env.crmE2ePlatformFixturesEnabled ? Promise.resolve([]) : listJobs(demoState.mode, { pageSize: 250 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Customer calls and messages</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">AI Receptionist</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          See what the AI handled, what needs a person, which channels are live, and test safely before customers do.
        </p>
      </div>

      <TabNav activeTab={activeTab} />

      {activeTab === "overview" ? <OverviewTab snapshot={initialSnapshot} recoveryCases={recoveryCases} /> : null}
      {activeTab === "needs-review" ? <NeedsReviewTab records={initialSnapshot.recentRecords} recoveryCases={recoveryCases} customers={customers} jobs={jobs} /> : null}
      {activeTab === "conversations" ? <ConversationsTab records={initialSnapshot.recentRecords} query={conversationQuery} selectedConversationId={selectedConversationId} /> : null}
      {activeTab === "bookings" ? <BookingsTab records={initialSnapshot.recentRecords} recoveryCases={recoveryCases} customers={customers} jobs={jobs} /> : null}
      {activeTab === "channels" ? <ChannelsTab snapshot={initialSnapshot} /> : null}
      {activeTab === "test" ? <TestTab initialSnapshot={initialSnapshot} /> : null}
      {activeTab === "settings" ? <SettingsTab snapshot={initialSnapshot} recoveryCases={recoveryCases} /> : null}
    </div>
  );
}

function TabNav({ activeTab }: { activeTab: AiHubTab }) {
  return (
    <nav className="flex flex-wrap gap-2 text-xs font-semibold" aria-label="AI Receptionist sections">
      {aiHubTabs.map((tab) => (
        <a
          key={tab.id}
          href={`/ai-hub?tab=${tab.id}`}
          className={`rounded-full px-3 py-1.5 ${
            activeTab === tab.id
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

function OverviewTab({
  snapshot,
  recoveryCases,
}: {
  snapshot: ChannelTestRuntimeSnapshot;
  recoveryCases: BookingRecoveryCase[];
}) {
  const status = frontDeskStatus(snapshot, recoveryCases);
  const channels = channelCards(snapshot);
  const readyChannels = channels.filter(([, details]) => details.ready).length;
  const todayRecords = snapshot.recentRecords.filter((record) => isToday(record.link.latest_event_at));
  const outcomeSummary = summarizeAiBusinessOutcomes(snapshot.recentRecords, recoveryCases);
  const bookingsToday = todayRecords.filter((record) => record.bookingAppointment).length;
  const enquiriesToday = todayRecords.filter((record) => record.lead).length;
  const latestActivity = latestEventAt(snapshot.recentRecords);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${status.className}`}>
                {status.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {snapshot.usingFixtures ? "Demo mode" : "Live mode"}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">
              {snapshot.runtime?.tenant?.name ?? "AI receptionist setup"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{status.detail}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Ready channels" value={`${readyChannels}/${channels.length || 4}`} detail="Customer entry points" />
            <MetricCard label="Last customer activity" value={formatDateTime(outcomeSummary.latestActivityAt ?? latestActivity)} detail="Across linked AI conversations" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Conversations today" value={String(outcomeSummary.conversationsToday)} detail="Linked AI activity" />
        <MetricCard label="Enquiries today" value={String(outcomeSummary.enquiriesToday || enquiriesToday)} detail="AI-linked CRM enquiries" />
        <MetricCard label="Bookings today" value={String(outcomeSummary.bookingsToday || bookingsToday)} detail="AI-linked appointments" />
        <MetricCard label="Needs review" value={String(outcomeSummary.needsReviewCount)} detail="Unsafe or unlinked AI outcomes" href="/ai-hub?tab=needs-review" />
        <MetricCard label="AI connection" value={snapshot.runtimeConfigured ? "Ready" : "Setup"} detail={formatRuntimeMode(snapshot.runtime?.runtimeMode ?? null)} />
      </section>

      <OutcomeSummaryCard summary={outcomeSummary} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RecentActivityCard records={snapshot.recentRecords.slice(0, 5)} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">What needs a person?</h2>
              <p className="mt-1 text-sm text-slate-500">AI work that is unsafe, unlinked, or waiting for office review.</p>
            </div>
            <a href="/ai-hub?tab=needs-review" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Open
            </a>
          </div>
          {recoveryCases.length === 0 ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              No AI booking review items are open.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {recoveryCases.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{item.customerName ?? item.service ?? "AI booking needs review"}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function NeedsReviewTab({
  records,
  recoveryCases,
  customers,
  jobs,
}: {
  records: PlatformConversationRecord[];
  recoveryCases: BookingRecoveryCase[];
  customers: Customer[];
  jobs: JobWithRelations[];
}) {
  const reviewableRecords = records.filter((record) => getPlatformConversationReviewState(record).needsReview);
  const summary = summarizeAiReviewQueue(recoveryCases);
  const totalReviewCount = summary.totalCount + reviewableRecords.length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Needs review</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              AI outcomes that need a person before the business treats them as safe.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            {summary.firstAction}
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <ReviewMetric label="Open" value={String(totalReviewCount)} />
          <ReviewMetric label="Conflicts" value={String(summary.conflictCount)} />
          <ReviewMetric label="Upcoming bookings" value={String(summary.upcomingBookingCount)} />
          <ReviewMetric label="Missing links" value={String(summary.missingLinkCount + reviewableRecords.length)} />
        </div>
      </section>
      {reviewableRecords.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Conversation handoffs</h2>
              <p className="mt-1 text-sm text-slate-500">AI conversations waiting for customer, enquiry, job, or booking links.</p>
            </div>
            <a href="/ai-hub?tab=conversations" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Open conversations
            </a>
          </div>
          <ConversationList records={reviewableRecords} />
        </section>
      ) : null}
      {recoveryCases.length > 0 ? (
        <BookingRecoveryPanel cases={recoveryCases} customers={customers} jobs={jobs} />
      ) : reviewableRecords.length === 0 ? (
        <EmptyState title="No AI review items" body="There are no unsafe or unlinked AI bookings waiting for office action." />
      ) : null}
    </div>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function OutcomeSummaryCard({ summary }: { summary: ReturnType<typeof summarizeAiBusinessOutcomes> }) {
  const rows = [
    ["Customer conversations", String(summary.conversationsToday)],
    ["Enquiries created or linked", String(summary.enquiriesToday)],
    ["Bookings created or linked", String(summary.bookingsToday)],
    ["Callbacks arranged", String(summary.callbacksToday)],
    ["Customers identified", String(summary.linkedCustomersToday)],
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Today&apos;s AI shift report</h2>
          <p className="mt-1 text-sm text-slate-500">Outcome counts from linked AI conversations.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{summary.firstAction}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConversationsTab({ records, query, selectedConversationId }: { records: PlatformConversationRecord[]; query: string; selectedConversationId: string | null }) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = normalizedQuery
    ? records.filter((record) =>
        [
          recordTitle(record),
          recordMeta(record),
          record.link.latest_channel,
          record.link.identity_phone,
          record.link.identity_email,
          record.customer?.postcode,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
      )
    : records;
  const selectedRecord = selectedConversationId
    ? records.find((record) => record.link.conversation_id === selectedConversationId || record.link.id === selectedConversationId) ?? null
    : filteredRecords[0] ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Conversations</h2>
            <p className="mt-2 text-sm text-slate-500">Recent AI conversations linked to customers, enquiries, jobs, or bookings.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{filteredRecords.length} shown</span>
        </div>
        <form action="/ai-hub" className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="tab" value="conversations" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search name, phone, channel, postcode..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Search
          </button>
        </form>
        <ConversationList records={filteredRecords} />
      </section>
      <ConversationDetail record={selectedRecord} />
    </div>
  );
}

function BookingsTab({
  records,
  recoveryCases,
  customers,
  jobs,
}: {
  records: PlatformConversationRecord[];
  recoveryCases: BookingRecoveryCase[];
  customers: Customer[];
  jobs: JobWithRelations[];
}) {
  const bookingRecords = records.filter((record) => record.bookingAppointment);

  return (
    <div className="space-y-6">
      {recoveryCases.length > 0 ? <BookingRecoveryPanel cases={recoveryCases} customers={customers} jobs={jobs} /> : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">AI bookings</h2>
        <p className="mt-2 text-sm text-slate-500">Bookings the AI has linked back into CRM activity.</p>
        {bookingRecords.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">No linked AI bookings yet.</p>
        ) : (
          <ConversationList records={bookingRecords} />
        )}
      </section>
    </div>
  );
}

function ChannelsTab({ snapshot }: { snapshot: ChannelTestRuntimeSnapshot }) {
  const channels = channelCards(snapshot);
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {channels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          The AI receptionist is not connected yet.
        </div>
      ) : (
        channels.map(([channel, details]) => <ChannelCard key={channel} channel={channel} details={details} />)
      )}
    </section>
  );
}

function TestTab({ initialSnapshot }: { initialSnapshot: ChannelTestRuntimeSnapshot }) {
  const scenarios = [
    {
      title: "Emergency repair",
      detail: "Boiler leak, no heating, vulnerable customer.",
      expected: "Escalate or book only within safe policy.",
    },
    {
      title: "Routine quote",
      detail: "Boiler installation enquiry with postcode and preferred date.",
      expected: "Qualify, create enquiry, avoid unsafe price promises.",
    },
    {
      title: "Missed call",
      detail: "Customer asks for a callback and gives a phone number.",
      expected: "Create callback work without inventing a job.",
    },
    {
      title: "Complaint",
      detail: "Customer is unhappy about engineer arrival or invoice.",
      expected: "Hand off to office with reason and transcript context.",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Safe test scenarios</h2>
            <p className="mt-2 text-sm text-slate-500">Use these checks before routing customers into a new or changed AI flow.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            {initialSnapshot.usingFixtures ? "Demo data" : "Live tenant"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {scenarios.map((scenario) => (
            <article key={scenario.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{scenario.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{scenario.detail}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{scenario.expected}</p>
            </article>
          ))}
        </div>
      </section>
      <LiveFrontDeskTester initialSnapshot={initialSnapshot} />
    </div>
  );
}

function SettingsTab({
  snapshot,
  recoveryCases,
}: {
  snapshot: ChannelTestRuntimeSnapshot;
  recoveryCases: BookingRecoveryCase[];
}) {
  const checks = readinessChecks(snapshot, recoveryCases);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">AI readiness checklist</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Check the settings that decide whether the AI can safely answer, qualify, book, and hand off customer work.
          </p>
        </div>
        <a href="/ai-settings" className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          Open AI settings
        </a>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <a key={check.label} href={check.href} className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-white">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">{check.label}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${check.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {check.ready ? "Ready" : "Needs setup"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </>
  );

  if (href) {
    return (
      <a href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:bg-slate-50">
        {content}
      </a>
    );
  }

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{content}</div>;
}

function RecentActivityCard({ records }: { records: PlatformConversationRecord[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recent AI activity</h2>
          <p className="mt-1 text-sm text-slate-500">What the AI last linked to the CRM.</p>
        </div>
        <a href="/ai-hub?tab=conversations" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          View all
        </a>
      </div>
      <ConversationList records={records} compact />
    </section>
  );
}

function ConversationList({
  records,
  compact = false,
}: {
  records: PlatformConversationRecord[];
  compact?: boolean;
}) {
  if (records.length === 0) {
    return <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">No recent AI conversations yet.</p>;
  }

  return (
    <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
      {records.map((record) => (
        <div key={record.link.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{recordTitle(record)}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {formatConversationChannel(record.link.latest_channel)}
              </span>
              {getPlatformConversationReviewState(record).needsReview ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                  Needs review
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-600">{recordMeta(record) || "Waiting to link to a customer or job."}</p>
            {!compact ? (
              <p className="mt-1 text-xs text-slate-500">Last activity {formatDateTime(record.link.latest_event_at)}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!compact ? <SmallLink href={`/ai-hub?tab=conversations&conversation=${record.link.conversation_id}`} label="Details" /> : null}
            {record.customer ? <SmallLink href={`/customers/${record.customer.id}`} label="Customer" /> : null}
            {record.lead ? <SmallLink href={`/leads?highlight=${record.lead.id}`} label="Enquiry" /> : null}
            {record.job ? <SmallLink href={`/jobs/${record.job.id}`} label="Job" /> : null}
            {record.bookingAppointment ? <SmallLink href="/calendar" label="Scheduler" /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversationDetail({ record }: { record: PlatformConversationRecord | null }) {
  if (!record) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
        No conversation selected.
      </section>
    );
  }

  const review = getPlatformConversationReviewState(record);
  const metadata = Object.entries(record.link.metadata ?? {}).filter(([, value]) => value !== null && value !== undefined);

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{recordTitle(record)}</h2>
          <p className="mt-1 text-sm text-slate-500">{formatConversationChannel(record.link.latest_channel)} · {formatDateTime(record.link.latest_event_at)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${review.needsReview ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
          {review.needsReview ? "Needs review" : "Linked"}
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <InfoRow label="Outcome" value={recordMeta(record) || "No CRM outcome linked yet."} />
        <InfoRow label="Customer identity" value={[record.link.identity_phone, record.link.identity_email].filter(Boolean).join(" · ") || "Not captured"} />
        <InfoRow label="Conversation ID" value={record.link.conversation_id} />
      </div>

      {review.reasons.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-950">Office action</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {review.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {record.customer ? <SmallLink href={`/customers/${record.customer.id}`} label="Open customer" /> : null}
        {record.lead ? <SmallLink href={`/leads?highlight=${record.lead.id}`} label="Open enquiry" /> : null}
        {record.job ? <SmallLink href={`/jobs/${record.job.id}`} label="Open job" /> : null}
        {record.bookingAppointment ? <SmallLink href="/calendar" label="Open scheduler" /> : null}
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Conversation data</summary>
        {metadata.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No extra metadata saved on this conversation.</p>
        ) : (
          <dl className="mt-3 space-y-2 text-xs text-slate-600">
            {metadata.slice(0, 8).map(([key, value]) => (
              <div key={key}>
                <dt className="font-semibold text-slate-800">{key}</dt>
                <dd className="break-words">{typeof value === "string" ? value : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </details>
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-800">{value}</p>
    </div>
  );
}

function ChannelCard({
  channel,
  details,
}: {
  channel: string;
  details: CustomerJourneysChannelStatus;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{formatChannelLabel(channel)}</h3>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${details.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          {details.ready ? "Working" : "Needs setup"}
        </span>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <InfoRow label="Customer entry" value={details.displayNumber ?? details.deepLink ?? "Not published"} />
        <InfoRow label="Last successful message" value="Not reported by channel provider" />
        <InfoRow label="Next action" value={channelNextAction(details)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {details.deepLink ? <SmallLink href={details.deepLink} label="Open channel" external /> : null}
        <SmallLink href="/ai-hub?tab=test" label="Test" />
        <SmallLink href="/ai-settings" label="Settings" />
      </div>
    </article>
  );
}

function channelNextAction(details: CustomerJourneysChannelStatus) {
  if (details.ready) {
    return "Send a safe test before changing public routing.";
  }
  if (details.reason) {
    return details.reason;
  }
  if (!details.enabled) {
    return "Enable this channel in AI settings.";
  }
  return "Check channel connection and routing.";
}

function SmallLink({
  href,
  label,
  external = false,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
    >
      {label}
    </a>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{body}</p>
    </section>
  );
}
