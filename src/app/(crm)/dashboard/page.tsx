import Link from "next/link";
import { EngineerDashboard } from "@/modules/crm/components/dashboard/EngineerDashboard";
import { CommsoftHome } from "@/modules/crm/components/commusoft/CommsoftHome";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";
import { getDashboardData, getEngineerDashboardData } from "@/modules/crm/lib/data";
import { getCrmDemoEmptyMessage } from "@/modules/crm/lib/demo";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { formatCurrency } from "@/modules/crm/lib/format";
import { jobStatusConfig } from "@/modules/crm/lib/status";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { getUiPreference } from "@/app/actions/ui-preference";

export default async function DashboardPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireCrmUser();
  const demoState = await getCrmDemoState();

  if (session.profile?.role === "engineer") {
    const [data, uiMode] = await Promise.all([
      getEngineerDashboardData(session.profile.full_name, demoState.mode),
      getUiPreference(),
    ]);
    if (uiMode === "classic") {
      return <EngineerDashboard data={data} engineerName={session.profile.full_name} />;
    }
    return <CommsoftHome data={data} engineerName={session.profile.full_name} />;
  }

  const data = await getDashboardData(demoState.mode);

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
