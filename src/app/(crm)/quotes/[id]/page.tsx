import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiActionButton } from "@/modules/crm/components/forms/ApiActionButton";
import { AttachmentUploadForm } from "@/modules/crm/components/forms/AttachmentUploadForm";
import { AttachmentList } from "@/modules/crm/components/shared/AttachmentList";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { formatCurrency, formatDate } from "@/modules/crm/lib/format";
import { getQuoteDetail, listAttachmentsForEntity } from "@/modules/crm/lib/data";
import { quoteStatusConfig } from "@/modules/crm/lib/status";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmUser();
  const { id } = await params;
  const [quote, attachments] = await Promise.all([getQuoteDetail(id), listAttachmentsForEntity("quote", id)]);
  if (!quote) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/quotes" className="hover:text-blue-700">
          Quotes
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{quote.quote_number}</span>
      </nav>

      <SectionCard title={quote.quote_number} action={<StatusBadge config={quoteStatusConfig[quote.status]} />} demoAnchor="quote-record">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{quote.customer?.full_name}</p>
            <p className="mt-1 text-sm text-slate-600">{quote.customer?.address_line1}</p>
            <p className="text-sm text-slate-600">{quote.customer?.postcode}</p>
            <p className="mt-3 text-sm text-slate-600">Valid until {formatDate(quote.valid_until)}</p>
          </div>
          <div className="flex gap-3 lg:justify-end">
            <a href={`/api/crm/quotes/${quote.id}/pdf`} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Download PDF
            </a>
            <ApiActionButton
              endpoint={`/api/crm/quotes/${quote.id}/convert`}
              label="Convert to Invoice"
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
              {quote.line_items.map((item, index) => (
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
            <span className="text-slate-900">{formatCurrency(quote.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">VAT</span>
            <span className="text-slate-900">{formatCurrency(quote.subtotal * quote.vat_rate)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(quote.total)}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`Attachments (${attachments.length})`}>
        <AttachmentList
          attachments={attachments}
          canDelete={userCanManageSettings(session.profile?.role)}
          emptyMessage="No quote attachments yet."
        />
        <div className="mt-4">
          <AttachmentUploadForm entityType="quote" entityId={quote.id} />
        </div>
      </SectionCard>
    </div>
  );
}
