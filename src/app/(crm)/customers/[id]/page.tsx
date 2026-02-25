import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getCustomer,
  getJobsForCustomer,
  getNotesForEntity,
  statusConfig,
  formatDate,
  formatDateTime,
} from '@/modules/crm/lib/mockData'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = getCustomer(id)
  if (!customer) notFound()

  const customerJobs = getJobsForCustomer(id)
  const customerNotes = getNotesForEntity('customer', id)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400">
        <Link href="/customers" className="hover:text-blue-600">Customers</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-700 font-medium">{customer.full_name}</span>
      </nav>

      {/* Customer header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold shrink-0">
              {customer.full_name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{customer.full_name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">Customer since {formatDate(customer.created_at)}</p>
            </div>
          </div>
          <button className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <InfoRow label="Phone" value={customer.phone} href={`tel:${customer.phone}`} />
          <InfoRow label="Email" value={customer.email} href={`mailto:${customer.email}`} />
          <InfoRow label="Address" value={`${customer.address_line1}, ${customer.city}`} />
          <InfoRow label="Postcode" value={customer.postcode} />
        </div>

        {customer.notes && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
            <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-yellow-900">{customer.notes}</p>
          </div>
        )}
      </div>

      {/* Jobs */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Jobs ({customerJobs.length})</h2>
          <button className="text-xs text-blue-600 font-medium hover:underline">+ New Job</button>
        </div>
        {customerJobs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No jobs yet.</p>
        ) : (
          <ul className="space-y-2">
            {customerJobs.map((job) => {
              const cfg = statusConfig[job.status]
              return (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">{job.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{job.scheduled_date} {job.scheduled_time} · {job.assigned_engineer}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Notes */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Notes ({customerNotes.length})</h2>
          <button className="text-xs text-blue-600 font-medium hover:underline">+ Add Note</button>
        </div>
        {customerNotes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {customerNotes.map((note) => (
              <li key={note.id} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-800">{note.body}</p>
                <p className="text-xs text-gray-400 mt-1.5">{note.created_by} · {formatDateTime(note.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
        {/* Add note demo input */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Add a note..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            readOnly
          />
          <button className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Save</button>
        </div>
      </section>
    </div>
  )
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      {href ? (
        <a href={href} className="text-sm text-blue-600 hover:underline mt-0.5 block">{value}</a>
      ) : (
        <p className="text-sm text-gray-800 mt-0.5">{value}</p>
      )}
    </div>
  )
}
