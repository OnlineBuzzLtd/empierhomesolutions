import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiActionButton } from "@/modules/crm/components/forms/ApiActionButton";
import { PaymentCreateForm } from "@/modules/crm/components/forms/PaymentCreateForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { formatCurrency, formatDate } from "@/modules/crm/lib/format";
import { getInvoiceDetail } from "@/modules/crm/lib/data";
import { invoiceStatusConfig } from "@/modules/crm/lib/status";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCrmUser();
  const { id } = await params;
  const detail = await getInvoiceDetail(id);
  if (!detail) {
    notFound();
  }

  const { invoice, payments } = detail;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/invoices" className="hover:text-blue-700">
          Invoices
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{invoice.invoice_number}</span>
      </nav>

      <SectionCard title={invoice.invoice_number} action={<StatusBadge config={invoiceStatusConfig[invoice.status]} />}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{invoice.customer?.full_name}</p>
            <p className="mt-1 text-sm text-slate-600">{invoice.customer?.address_line1}</p>
            <p className="text-sm text-slate-600">{invoice.customer?.postcode}</p>
            <p className="mt-3 text-sm text-slate-600">Due {formatDate(invoice.due_date)}</p>
          </div>
          <div className="flex gap-3 lg:justify-end">
            <a href={`/api/crm/invoices/${invoice.id}/pdf`} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Download PDF
            </a>
            <ApiActionButton
              endpoint={`/api/crm/invoices/${invoice.id}/mark-paid`}
              label="Mark Paid"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.line_items.map((item, index) => (
                <tr key={`${item.description}-${index}`}>
                  <td className="py-3 text-slate-800">{item.description}</td>
                  <td className="py-3 text-right text-slate-600">{item.qty}</td>
                  <td className="py-3 text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 text-right font-semibold text-slate-900">{formatCurrency(item.qty * item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 max-w-xs space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-900">{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">VAT</span>
            <span className="text-slate-900">{formatCurrency(invoice.subtotal * invoice.vat_rate)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title={`Payments (${payments.length})`}>
          {payments.length === 0 ? <EmptyState message="No payments recorded for this invoice." /> : null}
          <ul className="space-y-2">
            {payments.map((payment) => (
              <li key={payment.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{payment.payment_type}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(payment.amount)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {payment.status} · {payment.reference || "No reference"}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Add Payment">
          <PaymentCreateForm customerId={invoice.customer_id} invoiceId={invoice.id} quoteId={invoice.quote_id} />
        </SectionCard>
      </div>
    </div>
  );
}
