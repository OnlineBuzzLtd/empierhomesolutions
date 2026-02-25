import Link from 'next/link'
import { customers, jobs, statusConfig } from '@/modules/crm/lib/mockData'

const statusOrder: Array<import('@/modules/crm/lib/mockData').JobStatus> = [
  'enquiry', 'booked', 'in_progress', 'completed', 'invoiced',
]

export default function JobsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">{jobs.length} total jobs</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New Job
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <FilterTab label="All" count={jobs.length} active />
        {statusOrder.map((s) => {
          const count = jobs.filter((j) => j.status === s).length
          return <FilterTab key={s} label={statusConfig[s].label} count={count} />
        })}
      </div>

      {/* Jobs list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {jobs.map((job) => {
          const customer = customers.find((c) => c.id === job.customer_id)
          const cfg = statusConfig[job.status]
          return (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{job.title}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{customer?.full_name} · {customer?.postcode}</p>
                <p className="text-xs text-gray-400 mt-0.5">{job.scheduled_date} at {job.scheduled_time} · {job.assigned_engineer}</p>
              </div>
              <span className="text-gray-300 group-hover:text-gray-500 mt-1">›</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function FilterTab({ label, count, active }: { label: string; count: number; active?: boolean }) {
  return (
    <button className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
      active
        ? 'bg-gray-900 text-white border-gray-900'
        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
    }`}>
      {label} <span className="opacity-60">{count}</span>
    </button>
  )
}
