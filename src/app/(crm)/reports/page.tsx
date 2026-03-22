import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { formatCurrency } from "@/modules/crm/lib/format";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { getReportsSummary } from "@/modules/crm/lib/data";

export default async function ReportsPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireSettingsAccess();
  const demoState = await getCrmDemoState();
  const summary = await getReportsSummary(demoState.mode);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Management KPIs for revenue, pipeline conversion, job delivery, and engineer workload.</p>
      </div>

      <DemoAnchor name="reports-kpis">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Revenue" value={formatCurrency(summary.totalRevenue)} />
          <StatCard label="Unpaid" value={formatCurrency(summary.unpaidRevenue)} />
          <StatCard label="Profit Est." value={formatCurrency(summary.profitEstimate)} />
          <StatCard label="Lead Conversion" value={`${summary.convertedLeadCount}/${summary.leadCount || 0}`} />
          <StatCard label="Completed Jobs" value={`${summary.completedJobCount}/${summary.jobCount || 0}`} />
        </div>
      </DemoAnchor>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Invoice & Pipeline Summary">
          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <p>Invoices raised: <span className="font-semibold text-slate-900">{summary.invoiceCount}</span></p>
            <p>Paid invoices: <span className="font-semibold text-slate-900">{summary.paidInvoiceCount}</span></p>
            <p>Total leads: <span className="font-semibold text-slate-900">{summary.leadCount}</span></p>
            <p>Converted leads: <span className="font-semibold text-slate-900">{summary.convertedLeadCount}</span></p>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
