import Link from 'next/link'
import { invoices, customers, jobs, invoiceStatusConfig, formatCurrency, formatDate } from '@/modules/crm/lib/mockData'

export default function InvoicesPage() {
  const totalUnpaid = invoices.filter((i) => i.status === 'unpaid').reduce((s, i) => s + i.total, 0)
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">{invoices.length} invoices</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-yellow-50 rounded-xl p-4">
          <p className="text-xs font-medium text-yellow-700 uppercase tracking-wide">Unpaid</p>
          <p className="text-2xl font-bold text-yellow-900 mt-1">{formatCurrency(totalUnpaid)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Collected</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {invoices.map((invoice) => {
          const customer = customers.find((c) => c.id === invoice.customer_id)
          const job = jobs.find((j) => j.id === invoice.job_id)
          const cfg = invoiceStatusConfig[invoice.status]
          return (
            <Link
              key={invoice.id}
              href={`/invoices/${invoice.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{invoice.invoice_number}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{customer?.full_name} · {job?.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">Due {formatDate(invoice.due_date)}</p>
              </div>
              <p className="text-base font-bold text-gray-900 shrink-0">{formatCurrency(invoice.total)}</p>
              <span className="text-gray-300 group-hover:text-gray-500">›</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
