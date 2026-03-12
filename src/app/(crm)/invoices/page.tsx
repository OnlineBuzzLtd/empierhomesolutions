import Link from "next/link";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { formatCurrency, formatDate } from "@/modules/crm/lib/format";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { invoiceStatusConfig } from "@/modules/crm/lib/status";
import { listInvoices } from "@/modules/crm/lib/data";

export default async function InvoicesPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const invoices = await listInvoices();
  const totalUnpaid = invoices.filter((invoice) => invoice.status === "unpaid").reduce((sum, invoice) => sum + invoice.total, 0);
  const totalPaid = invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">{invoices.length} invoices in CRM.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard label="Unpaid" value={formatCurrency(totalUnpaid)} />
        <SummaryCard label="Paid" value={formatCurrency(totalPaid)} />
      </div>

      <SectionCard title="Invoice List">
        {invoices.length === 0 ? (
          <EmptyState message="No invoices yet." />
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {invoices.map((invoice) => (
              <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{invoice.invoice_number}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {invoice.customer?.full_name ?? "Customer"} · {invoice.job?.title ?? "Job"} · Due {formatDate(invoice.due_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge config={invoiceStatusConfig[invoice.status]} />
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(invoice.total)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
