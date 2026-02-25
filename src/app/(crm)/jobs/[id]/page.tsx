import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getJob,
  getCustomer,
  getNotesForEntity,
  getExpensesForJob,
  getQuoteForJob,
  getInvoiceForJob,
  statusConfig,
  invoiceStatusConfig,
  quoteStatusConfig,
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/modules/crm/lib/mockData'

const statusFlow = ['enquiry', 'booked', 'in_progress', 'completed', 'invoiced'] as const

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = getJob(id)
  if (!job) notFound()

  const customer = getCustomer(job.customer_id)
  const notes = getNotesForEntity('job', job.id)
  const expenses = getExpensesForJob(job.id)
  const quote = getQuoteForJob(job.id)
  const invoice = getInvoiceForJob(job.id)
  const statusCfg = statusConfig[job.status]
  const currentStep = statusFlow.indexOf(job.status)
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400">
        <Link href="/jobs" className="hover:text-blue-600">Jobs</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-700 font-medium truncate">{job.title}</span>
      </nav>

      {/* Job header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
              <span className="text-xs text-gray-400">{job.scheduled_date} at {job.scheduled_time}</span>
              <span className="text-xs text-gray-400">· {job.assigned_engineer}</span>
            </div>
          </div>
          <button className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors shrink-0">Edit</button>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">{job.description}</p>

        {/* Customer link */}
        {customer && (
          <Link href={`/customers/${customer.id}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
              {customer.full_name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">{customer.full_name}</p>
              <p className="text-xs text-gray-500">{customer.phone} · {customer.postcode}</p>
            </div>
          </Link>
        )}

        {/* Status progress */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Status Progress</p>
          <div className="flex items-center gap-1">
            {statusFlow.map((s, i) => {
              const cfg = statusConfig[s]
              const done = i <= currentStep
              return (
                <div key={s} className="flex items-center flex-1 min-w-0">
                  <div className={`flex-1 h-1.5 rounded-full ${done ? 'bg-blue-500' : 'bg-gray-200'}`} />
                  {i === statusFlow.length - 1 && (
                    <div className={`w-2.5 h-2.5 rounded-full ml-1 ${done ? 'bg-blue-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            {statusFlow.map((s, i) => (
              <p key={s} className={`text-[10px] ${i <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {statusConfig[s].label}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Quote */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Quote</h2>
          {quote ? (
            <Link href={`/quotes/${quote.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{quote.quote_number}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${quoteStatusConfig[quote.status].color}`}>{quoteStatusConfig[quote.status].label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(quote.total)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Valid until {formatDate(quote.valid_until)}</p>
            </Link>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-2">No quote yet</p>
              <button className="text-xs text-blue-600 font-medium hover:underline">+ Create Quote</button>
            </div>
          )}
        </section>

        {/* Invoice */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Invoice</h2>
          {invoice ? (
            <Link href={`/invoices/${invoice.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${invoiceStatusConfig[invoice.status].color}`}>{invoiceStatusConfig[invoice.status].label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(invoice.total)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Due {formatDate(invoice.due_date)}</p>
            </Link>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-2">No invoice yet</p>
              <button className="text-xs text-blue-600 font-medium hover:underline">+ Create Invoice</button>
            </div>
          )}
        </section>
      </div>

      {/* Expenses */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Expenses</h2>
          <button className="text-xs text-blue-600 font-medium hover:underline">+ Log Expense</button>
        </div>
        {expenses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No expenses logged.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {expenses.map((exp) => (
                <li key={exp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{exp.description}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{exp.category} · {exp.created_by}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(exp.amount)}</p>
                </li>
              ))}
            </ul>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">Total expenses</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(expenseTotal)}</p>
            </div>
          </>
        )}
      </section>

      {/* Notes */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Site Notes ({notes.length})</h2>
          <button className="text-xs text-blue-600 font-medium hover:underline">+ Add Note</button>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-800 leading-relaxed">{note.body}</p>
                <p className="text-xs text-gray-400 mt-1.5">{note.created_by} · {formatDateTime(note.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Add a site note..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            readOnly
          />
          <button className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Save</button>
        </div>
      </section>

      {/* Photo upload placeholder */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Photos & Documents</h2>
          <button className="text-xs text-blue-600 font-medium hover:underline">+ Upload</button>
        </div>
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <p className="text-2xl mb-2">📷</p>
          <p className="text-sm text-gray-400">Drag photos here or tap to upload</p>
          <p className="text-xs text-gray-300 mt-1">Supports photos, PDFs, certificates</p>
        </div>
      </section>
    </div>
  )
}
