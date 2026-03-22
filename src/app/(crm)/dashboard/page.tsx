import Link from "next/link";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";
import { getAddonState, resolveAiHubViewState } from "@/modules/crm/lib/addons";
import { getAiHubProvider } from "@/modules/crm/lib/ai-hub";
import { getDashboardData } from "@/modules/crm/lib/data";
import { getCrmDemoEmptyMessage } from "@/modules/crm/lib/demo";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { formatCurrency } from "@/modules/crm/lib/format";
import { jobStatusConfig } from "@/modules/crm/lib/status";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { getCrmSession, requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { getCrmSetupState } from "@/modules/crm/lib/setup";

export default async function DashboardPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireCrmUser();
  const demoState = await getCrmDemoState();
  const provider = getAiHubProvider();
  const [data, addon, aiMetrics, fullSession] = await Promise.all([
    getDashboardData(demoState.mode),
    getAddonState("ai_comms_hub"),
    provider.getAggregateMetrics(),
    getCrmSession(),
  ]);
  const aiHubViewState = resolveAiHubViewState(addon, fullSession.profile?.role);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Live CRM overview from Supabase.</p>
      </div>

      <DemoAnchor name="dashboard-overview">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open Jobs" value={String(data.openJobsCount)} sub="enquiry / booked / in progress" />
          <StatCard label="Today&apos;s Jobs" value={String(data.todaysJobs.length)} sub="scheduled today" />
          <StatCard label="Unpaid Invoices" value={formatCurrency(data.unpaidInvoicesTotal)} sub="awaiting payment" />
          <StatCard label="Open Leads" value={String(data.newLeadCount)} sub="new / follow-up workload" />
        </div>
      </DemoAnchor>

      {!addon.enabled ? (
        <section className="rounded-3xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] p-5 shadow-lg shadow-amber-100/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Paid Add-On Preview</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">AI Hub</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Turn missed calls, SMS, WhatsApp, and website chats into qualified CRM activity automatically. The demo shows the comms journey and the CRM updates side by side.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/ai-hub" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                {aiHubViewState === "demo" ? "Watch Add-On Demo" : "View Add-On"}
              </Link>
              {userCanManageSettings(session.profile?.role) ? (
                <a
                  href={addon.cta_url ?? "https://customerjourneys.ai/en-GB/demo"}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Upgrade
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Missed Calls Recovered" value={String(aiMetrics.missed_calls_recovered)} sub="monthly demo KPI" />
            <StatCard label="Bookings Captured" value={String(aiMetrics.bookings_captured)} sub="monthly demo KPI" />
            <StatCard label="Leads Qualified" value={String(aiMetrics.leads_qualified)} sub="monthly demo KPI" />
            <StatCard label="Response Time" value={`${aiMetrics.average_response_minutes} min`} sub="average first reply" />
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Jobs</h2>
            <Link href="/jobs" className="text-xs font-medium text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {data.todaysJobs.length === 0 ? (
            <p className="text-sm text-slate-500">{demoState.active ? getCrmDemoEmptyMessage("today's jobs") : "No jobs scheduled today."}</p>
          ) : (
            <ul className="space-y-3">
              {data.todaysJobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex items-start justify-between gap-3 rounded-lg p-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.customer?.full_name ?? "Customer"} · {job.scheduled_time ?? "Time TBC"} · {job.assigned_engineer ?? "Unassigned"}
                      </p>
                    </div>
                    <StatusBadge config={jobStatusConfig[job.status]} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Customers</h2>
            <Link href="/customers" className="text-xs font-medium text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {data.recentCustomers.length === 0 ? (
            <p className="text-sm text-slate-500">{demoState.active ? getCrmDemoEmptyMessage("recent customers") : "No recent customers yet."}</p>
          ) : (
            <ul className="space-y-3">
              {data.recentCustomers.map((customer) => (
                <li key={customer.id}>
                  <Link href={`/customers/${customer.id}`} className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
                      {customer.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{customer.full_name}</p>
                      <p className="text-xs text-slate-500">{customer.postcode || "No postcode"}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Active Jobs</h2>
          <Link href="/jobs" className="text-xs font-medium text-blue-600 hover:underline">
            View jobs
          </Link>
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
              {data.activeJobs.map((job) => (
                <tr key={job.id}>
                  <td className="py-3">
                    <Link href={`/jobs/${job.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                      {job.title}
                    </Link>
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
        {data.activeJobs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{demoState.active ? getCrmDemoEmptyMessage("active jobs") : "No active jobs right now."}</p>
        ) : null}
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
