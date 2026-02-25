import Link from 'next/link'
import { quotes, customers, jobs, quoteStatusConfig, formatCurrency, formatDate } from '@/modules/crm/lib/mockData'

export default function QuotesPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-gray-500 text-sm mt-1">{quotes.length} quotes</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New Quote
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {quotes.map((quote) => {
          const customer = customers.find((c) => c.id === quote.customer_id)
          const job = jobs.find((j) => j.id === quote.job_id)
          const cfg = quoteStatusConfig[quote.status]
          return (
            <Link
              key={quote.id}
              href={`/quotes/${quote.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{quote.quote_number}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{customer?.full_name} · {job?.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">Valid until {formatDate(quote.valid_until)}</p>
              </div>
              <p className="text-base font-bold text-gray-900 shrink-0">{formatCurrency(quote.total)}</p>
              <span className="text-gray-300 group-hover:text-gray-500">›</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
