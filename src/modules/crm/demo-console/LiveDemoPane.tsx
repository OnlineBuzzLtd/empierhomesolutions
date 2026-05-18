"use client";

import { useDemoSessionFeed, type DemoFeedRow } from "@/modules/crm/demo-console/use-demo-session-feed";

// Live CRM pane (ticket C-4). Renders the four lists from
// useDemoSessionFeed as cards with channel badges and time-since-created.
// Designed to be embedded in /demo/run alongside the prospect-facing
// tiles — see ticket D-1 for the wrapping fullscreen layout.

type LiveDemoPaneProps = {
  sessionStartedAt: Date | null;
  tenantId: string | null;
};

export function LiveDemoPane({ sessionStartedAt, tenantId }: LiveDemoPaneProps) {
  const feed = useDemoSessionFeed({ sessionStartedAt, tenantId });
  const totalEvents =
    feed.customers.length + feed.leads.length + feed.jobs.length + feed.appointments.length;

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Live CRM
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">
            {totalEvents === 0 ? "Waiting for the first lead…" : `${totalEvents} events`}
          </p>
        </div>
        <StatusPill status={feed.status} />
      </header>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-2">
        <FeedColumn title="Customers" rows={feed.customers} formatTitle={(r) => formatCustomerTitle(r)} />
        <FeedColumn title="Leads" rows={feed.leads} formatTitle={(r) => formatLeadTitle(r)} />
        <FeedColumn title="Jobs" rows={feed.jobs} formatTitle={(r) => formatJobTitle(r)} />
        <FeedColumn
          title="Appointments"
          rows={feed.appointments}
          formatTitle={(r) => formatAppointmentTitle(r)}
        />
      </div>

      {sessionStartedAt === null ? (
        <footer className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Start a demo session from the operator panel (Ctrl+Shift+D) to begin watching the feed.
        </footer>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: ReturnType<typeof useDemoSessionFeed>["status"] }) {
  const className =
    status === "live"
      ? "bg-emerald-100 text-emerald-700"
      : status === "connecting"
        ? "bg-amber-100 text-amber-700"
        : status === "error"
          ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-600";
  const label =
    status === "live"
      ? "Live"
      : status === "connecting"
        ? "Connecting"
        : status === "error"
          ? "Error"
          : "Idle";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          status === "live"
            ? "bg-emerald-500"
            : status === "connecting"
              ? "bg-amber-500"
              : status === "error"
                ? "bg-rose-500"
                : "bg-slate-400"
        }`}
      />
      {label}
    </span>
  );
}

function FeedColumn({
  title,
  rows,
  formatTitle,
}: {
  title: string;
  rows: DemoFeedRow[];
  formatTitle: (row: DemoFeedRow) => string;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-slate-100 bg-slate-50/50">
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {title}
        </h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {rows.length}
        </span>
      </header>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {rows.length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-slate-400">No rows yet.</p>
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              className="animate-[fadeIn_180ms_ease-out] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-900">{formatTitle(row)}</p>
                <ChannelBadge source={row.source ?? row.channel ?? null} />
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">{formatTimeAgo(row.created_at)}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ChannelBadge({ source }: { source: string | null }) {
  if (!source) return null;
  // Normalise the variants the codebase already emits (ai_webchat,
  // ai_sms, ai_voice, ai_whatsapp, platform_voice, empire_lp, …).
  const normalised = source.toLowerCase();
  let label = source;
  let className = "bg-slate-100 text-slate-700";
  if (normalised.includes("voice")) {
    label = "Voice";
    className = "bg-purple-100 text-purple-700";
  } else if (normalised.includes("webchat") || normalised.includes("chat")) {
    label = "Webchat";
    className = "bg-blue-100 text-blue-700";
  } else if (normalised.includes("whatsapp") || normalised.includes("wa")) {
    label = "WhatsApp";
    className = "bg-emerald-100 text-emerald-700";
  } else if (normalised.includes("sms")) {
    label = "SMS";
    className = "bg-cyan-100 text-cyan-700";
  } else if (normalised.includes("google")) {
    label = "Google";
    className = "bg-amber-100 text-amber-700";
  } else if (normalised.includes("meta") || normalised.includes("facebook")) {
    label = "Meta";
    className = "bg-indigo-100 text-indigo-700";
  } else if (normalised.includes("empire_lp") || normalised.includes("website")) {
    label = "Website";
    className = "bg-slate-200 text-slate-700";
  }
  return (
    <span
      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(iso).toLocaleTimeString();
}

function formatCustomerTitle(row: DemoFeedRow): string {
  const name =
    typeof row.raw.full_name === "string" && row.raw.full_name.trim().length > 0
      ? row.raw.full_name
      : null;
  const phone = typeof row.raw.phone === "string" ? row.raw.phone : null;
  return name ?? phone ?? "New customer";
}

function formatLeadTitle(row: DemoFeedRow): string {
  const status = typeof row.raw.status === "string" ? row.raw.status : "lead";
  const urgency = typeof row.raw.urgency_level === "string" ? row.raw.urgency_level : null;
  return urgency ? `Lead · ${status} (${urgency})` : `Lead · ${status}`;
}

function formatJobTitle(row: DemoFeedRow): string {
  return typeof row.raw.title === "string" ? row.raw.title : "New job";
}

function formatAppointmentTitle(row: DemoFeedRow): string {
  const title = typeof row.raw.title === "string" ? row.raw.title : "Appointment";
  const startsAt = typeof row.raw.starts_at === "string" ? row.raw.starts_at : null;
  if (!startsAt) return title;
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) return title;
  return `${title} · ${when.toLocaleDateString()} ${when.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
