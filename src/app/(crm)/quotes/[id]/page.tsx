import Link from 'next/link'
import { notFound } from 'next/navigation'
import { quotes, customers, jobs, quoteStatusConfig, formatCurrency, formatDate } from '@/modules/crm/lib/mockData'

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quote = quotes.find((q) => q.id === id)
  if (!quote) notFound()

  const customer = customers.find((c) => c.id === quote.customer_id)
  const job = jobs.find((j) => j.id === quote.job_id)
  const cfg = quoteStatusConfig[quote.status]
  const vatAmount = quote.subtotal * quote.vat_rate

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="text-sm text-gray-400">
        <Link href="/quotes" className="hover:text-blue-600">Quotes</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-700 font-medium">{quote.quote_number}</span>
      </nav>

      {/* Quote document */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Empire Home Solutions</p>
              <p className="text-2xl font-bold mt-1">{quote.quote_number}</p>
              <p className="text-sm text-gray-400 mt-0.5">Valid until {formatDate(quote.valid_until)}</p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Customer */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Customer</p>
              <p className="text-sm font-semibold text-gray-900">{customer?.full_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{customer?.address_line1}, {customer?.postcode}</p>
              <p className="text-xs text-gray-500">{customer?.phone}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Job Reference</p>
              {job && (
                <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-blue-600 hover:underline">{job.title}</Link>
              )}
            </div>
          </div>

          {/* Line items */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Line Items</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium text-right w-12">Qty</th>
                  <th className="pb-2 font-medium text-right w-24">Unit</th>
                  <th className="pb-2 font-medium text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quote.line_items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-4 text-gray-800">{item.description}</td>
                    <td className="py-2.5 text-right text-gray-600">{item.qty}</td>
                    <td className="py-2.5 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900">{formatCurrency(item.qty * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 pt-4 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>VAT ({(quote.vat_rate * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-200">
              <span>Total</span>
              <span>{formatCurrency(quote.total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              📄 Download PDF
            </button>
            <button className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              ✓ Convert to Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
