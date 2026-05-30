"use client";

import { useMemo } from "react";
import { CommsoftDiary } from "@/modules/crm/components/commusoft/CommsoftDiary";
import { CommsoftHome } from "@/modules/crm/components/commusoft/CommsoftHome";
import { EngineerDashboard } from "@/modules/crm/components/dashboard/EngineerDashboard";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";
import { WeekTimeline } from "@/modules/crm/components/calendar/WeekTimeline";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { CrmInstantLink, useCrmApi } from "@/modules/crm/components/client/CrmClientRuntime";
import { formatCurrency } from "@/modules/crm/lib/format";
import { jobStatusConfig } from "@/modules/crm/lib/status";
import { appointmentStatuses, appointmentTypes } from "@/modules/crm/types";
import type {
  CalendarItem,
  DashboardData,
  EngineerDashboardData,
  EngineerDashboardJob,
  ReportsSummary,
  UserProfile,
} from "@/modules/crm/types";

type ApiData<T> = {
  ok: true;
  data: T;
};

type ReportsApiData = {
  ok: true;
  summary: ReportsSummary;
};

type CalendarApiData = {
  ok: true;
  data: {
    appointments: CalendarItem[];
    users: UserProfile[];
    weekReferenceIso: string;
  };
};

type EngineerApiData = {
  ok: true;
  data: EngineerDashboardData;
  engineerName: string;
};

function ScreenLoading({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
      {label}
    </div>
  );
}

function ScreenError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
      {message}
    </div>
  );
}

export function DashboardClientPanel({ demoActive }: { demoActive: boolean }) {
  const { data, error, loading } = useCrmApi<ApiData<DashboardData>>("/api/crm/dashboard/summary", {
    ttlMs: 20_000,
  });

  if (error) {
    return <ScreenError message={error} />;
  }
  if (!data) {
    return <ScreenLoading label={loading ? "Loading dashboard..." : "Preparing dashboard..."} />;
  }

  const dashboard = data.data;

  return (
    <div className="space-y-8" data-crm-screen-ready="true">
      <DemoAnchor name="dashboard-overview">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Trade control centre</h2>
            <p className="mt-1 text-sm text-slate-500">The work that needs attention today.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AttentionCard href="/jobs" label="Jobs today" value={String(dashboard.todaysJobs.length)} action="Check schedule" />
            <AttentionCard href="/calendar" label="Jobs tomorrow" value="Open scheduler" action="Plan ahead" />
            <AttentionCard href="/leads?tab=todo" label="Enquiries to do" value={String(dashboard.newLeadCount)} action="Follow up" />
            <AttentionCard href="/quotes" label="Quotes to chase" value="Review quotes" action="Open quotes" />
            <AttentionCard href="/invoices" label="Unpaid invoices" value={formatCurrency(dashboard.unpaidInvoicesTotal)} action="Chase payment" />
            <AttentionCard href="/ai-hub" label="AI receptionist needs review" value={String(dashboard.aiReceptionistReviewCount)} action="Review" />
          </div>
        </div>
      </DemoAnchor>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Jobs today</h2>
            <CrmInstantLink href="/jobs" className="text-xs font-medium text-blue-600 hover:underline">
              View all
            </CrmInstantLink>
          </div>
          {dashboard.todaysJobs.length === 0 ? (
            <p className="text-sm text-slate-500">
              {demoActive ? "Demo data has no scheduled jobs for today." : "No jobs today. Create a job when work is ready to schedule."}
            </p>
          ) : (
            <ul className="space-y-3">
              {dashboard.todaysJobs.map((job) => (
                <li key={job.id}>
                  <CrmInstantLink href={`/jobs/${job.id}`} className="flex items-start justify-between gap-3 rounded-lg p-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.customer?.full_name ?? "Customer"} · {job.scheduled_time ?? "Time TBC"} · {job.assigned_engineer ?? "Unassigned"}
                      </p>
                    </div>
                    <StatusBadge config={jobStatusConfig[job.status]} />
                  </CrmInstantLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Customers</h2>
            <CrmInstantLink href="/customers" className="text-xs font-medium text-blue-600 hover:underline">
              View all
            </CrmInstantLink>
          </div>
          {dashboard.recentCustomers.length === 0 ? (
            <p className="text-sm text-slate-500">{demoActive ? "Demo data has no recent customers." : "No recent customers yet."}</p>
          ) : (
            <ul className="space-y-3">
              {dashboard.recentCustomers.map((customer) => (
                <li key={customer.id}>
                  <CrmInstantLink href={`/customers/${customer.id}`} className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
                      {customer.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{customer.full_name}</p>
                      <p className="text-xs text-slate-500">{customer.postcode || "No postcode"}</p>
                    </div>
                  </CrmInstantLink>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Active Jobs</h2>
          <CrmInstantLink href="/jobs" className="text-xs font-medium text-blue-600 hover:underline">
            View jobs
          </CrmInstantLink>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">Job</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Service</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dashboard.activeJobs.map((job) => (
                <tr key={job.id}>
                  <td className="py-3">
                    <CrmInstantLink href={`/jobs/${job.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                      {job.title}
                    </CrmInstantLink>
                  </td>
                  <td className="py-3 text-slate-600">{job.customer?.full_name ?? "Customer"}</td>
                  <td className="py-3 text-slate-600">{job.service?.name ?? "Not set"}</td>
                  <td className="py-3 text-slate-600">{job.scheduled_date ?? "TBC"}</td>
                  <td className="py-3">
                    <StatusBadge config={jobStatusConfig[job.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dashboard.activeJobs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{demoActive ? "Demo data has no active jobs." : "No active jobs right now."}</p>
        ) : null}
      </section>
    </div>
  );
}

export function EngineerHomeClientPanel({ uiMode }: { uiMode: "classic" | "commsoft" }) {
  const { data, error, loading } = useCrmApi<EngineerApiData>("/api/crm/engineer/diary", { ttlMs: 15_000 });

  if (error) {
    return <ScreenError message={error} />;
  }
  if (!data) {
    return <ScreenLoading label={loading ? "Loading engineer dashboard..." : "Preparing engineer dashboard..."} />;
  }

  return (
    <div data-crm-screen-ready="true">
      {uiMode === "classic" ? (
        <EngineerDashboard data={data.data} engineerName={data.engineerName} />
      ) : (
        <CommsoftHome data={data.data} engineerName={data.engineerName} />
      )}
    </div>
  );
}

export function ReportsClientPanel() {
  const { data, error, loading } = useCrmApi<ReportsApiData>("/api/crm/reports/summary", { ttlMs: 30_000 });

  if (error) {
    return <ScreenError message={error} />;
  }
  if (!data) {
    return <ScreenLoading label={loading ? "Loading reports..." : "Preparing reports..."} />;
  }

  const summary = data.summary;

  return (
    <div className="space-y-6" data-crm-screen-ready="true">
      <DemoAnchor name="reports-kpis">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Revenue" value={formatCurrency(summary.totalRevenue)} />
          <StatCard label="Unpaid" value={formatCurrency(summary.unpaidRevenue)} />
          <StatCard label="Profit Est." value={formatCurrency(summary.profitEstimate)} />
          <StatCard label="Enquiry Conversion" value={`${summary.convertedLeadCount}/${summary.leadCount || 0}`} />
          <StatCard label="Completed Jobs" value={`${summary.completedJobCount}/${summary.jobCount || 0}`} />
        </div>
      </DemoAnchor>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Invoice & Pipeline Summary">
          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <p>Invoices raised: <span className="font-semibold text-slate-900">{summary.invoiceCount}</span></p>
            <p>Paid invoices: <span className="font-semibold text-slate-900">{summary.paidInvoiceCount}</span></p>
            <p>Total enquiries: <span className="font-semibold text-slate-900">{summary.leadCount}</span></p>
            <p>Converted enquiries: <span className="font-semibold text-slate-900">{summary.convertedLeadCount}</span></p>
            <p>Total expenses: <span className="font-semibold text-slate-900">{formatCurrency(summary.totalExpenses)}</span></p>
          </div>
        </SectionCard>

        <SectionCard title="Engineer Workload">
          {summary.engineerWorkload.length === 0 ? (
            <p className="text-sm text-slate-500">No engineer workload data yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.engineerWorkload.map((engineer) => (
                <div key={engineer.engineer} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                  <p className="font-semibold text-slate-900">{engineer.engineer}</p>
                  <p className="mt-1 text-slate-600">
                    {engineer.totalJobs} total · {engineer.completedJobs} completed · {engineer.openJobs} open
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export function CalendarWeekClientPanel({
  apiUrl,
  type,
  status,
  assignedTo,
  weekParam,
  weekReferenceIso,
  weekLabel,
  prevHref,
  nextHref,
  todayHref,
  demoActive,
}: {
  apiUrl: string;
  type: string | null;
  status: string | null;
  assignedTo: string | null;
  weekParam: string | null;
  weekReferenceIso: string;
  weekLabel: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  demoActive: boolean;
}) {
  const { data, error } = useCrmApi<CalendarApiData>(apiUrl, { ttlMs: 15_000 });
  const appointments = data?.data.appointments ?? [];
  const users = data?.data.users ?? [];
  const timelineWeekReferenceIso = data?.data.weekReferenceIso ?? weekReferenceIso;

  return (
    <SectionCard
      title="Week timeline"
      demoAnchor="calendar-schedule"
      action={
        <div className="flex items-center gap-2 text-xs">
          <CrmInstantLink
            href={prevHref}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
            aria-label="Previous week"
          >
            ←
          </CrmInstantLink>
          <CrmInstantLink
            href={todayHref}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50"
          >
            Today
          </CrmInstantLink>
          <CrmInstantLink
            href={nextHref}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
            aria-label="Next week"
          >
            →
          </CrmInstantLink>
          <span className="ml-2 text-slate-600">{weekLabel}</span>
        </div>
      }
    >
      {error ? <ScreenError message={error} /> : null}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {appointmentStatuses.map((value) => (
          <CalendarFilterLink
            key={value}
            href={`/calendar${buildFilterQuery({ type, assignedTo, status: value, week: weekParam })}`}
            active={status === value}
            label={value}
          />
        ))}
        {users.map((user) => (
          <CalendarFilterLink
            key={user.user_id}
            href={`/calendar${buildFilterQuery({ type, status, assignedTo: user.user_id, week: weekParam })}`}
            active={assignedTo === user.user_id}
            label={user.full_name}
          />
        ))}
      </div>

      <div data-crm-screen-ready={data ? "true" : undefined}>
        <WeekTimeline appointments={appointments} weekReferenceIso={timelineWeekReferenceIso} />
      </div>

      {!data ? (
        <p className="mt-4 text-sm text-slate-500">Loading calendar items...</p>
      ) : appointments.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            message={
              demoActive
                ? "Demo data has no calendar items in this week."
                : "No items in this week. Use the prev / next arrows to browse other weeks or add one on the right."
            }
          />
        </div>
      ) : null}
    </SectionCard>
  );
}

export function CalendarTypeFilters({
  type,
  status,
  assignedTo,
  weekParam,
}: {
  type: string | null;
  status: string | null;
  assignedTo: string | null;
  weekParam: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <CalendarFilterLink href="/calendar" active={!type && !status && !assignedTo} label="All items" />
      {appointmentTypes.map((value) => (
        <CalendarFilterLink
          key={value}
          href={`/calendar${buildFilterQuery({ type: value, status, assignedTo, week: weekParam })}`}
          active={type === value}
          label={value.replaceAll("_", " ")}
        />
      ))}
    </div>
  );
}

export function DiaryClientPanel() {
  const { data, error, loading } = useCrmApi<EngineerApiData>("/api/crm/engineer/diary", { ttlMs: 15_000 });
  const jobs = useMemo(() => {
    if (!data) {
      return [] as EngineerDashboardJob[];
    }
    const allJobs = [
      ...(data.data.todaysAssignedJobs ?? []),
      ...(data.data.upcomingAssignedJobs ?? []),
      ...(data.data.overdueAssignedJobs ?? []),
      ...(data.data.readyJobs ?? []),
      ...(data.data.completedAssignedJobs ?? []),
    ];
    return Array.from(new Map(allJobs.map((job) => [job.id, job])).values());
  }, [data]);

  if (error) {
    return <ScreenError message={error} />;
  }
  if (!data) {
    return <ScreenLoading label={loading ? "Loading diary..." : "Preparing diary..."} />;
  }

  return (
    <div data-crm-screen-ready="true">
      <CommsoftDiary jobs={jobs} completedJobs={data.data.completedAssignedJobs ?? []} />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function AttentionCard({ href, label, value, action }: { href: string; label: string; value: string; action: string }) {
  return (
    <CrmInstantLink href={href} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-200 hover:bg-blue-50/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm font-semibold text-blue-700">{action}</p>
    </CrmInstantLink>
  );
}

function CalendarFilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <CrmInstantLink
      href={href}
      className={`rounded-full px-3 py-1.5 font-medium capitalize ${
        active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </CrmInstantLink>
  );
}

function buildFilterQuery(filters: {
  type: string | null;
  status: string | null;
  assignedTo: string | null;
  week?: string | null;
}) {
  const search = new URLSearchParams();
  if (filters.type) search.set("type", filters.type);
  if (filters.status) search.set("status", filters.status);
  if (filters.assignedTo) search.set("assigned_to", filters.assignedTo);
  if (filters.week) search.set("week", filters.week);
  const value = search.toString();
  return value ? `?${value}` : "";
}

export function buildCalendarApiUrl(filters: {
  type: string | null;
  status: string | null;
  assignedTo: string | null;
  week?: string | null;
}) {
  return `/api/crm/calendar/week${buildFilterQuery(filters)}`;
}
