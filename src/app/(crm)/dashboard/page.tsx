import Link from 'next/link'
import {
  customers,
  jobs,
  invoices,
  statusConfig,
  invoiceStatusConfig,
  formatCurrency,
  getOpenJobsCount,
} from '@/modules/crm/lib/mockData'

export default function DashboardPage() {
  const todayStr = '2026-02-19' // pinned for demo
  const todaysJobs = jobs.filter((j) => j.scheduled_date === todayStr)
  const openCount = getOpenJobsCount()
  const recentCustomers = [...customers].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4)
  const unpaidTotal = invoices.filter((i) => i.status === 'unpaid').reduce((sum, i) => sum + i.total, 0)
  const enquiryCount = jobs.filter((j) => j.status === 'enquiry').length

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Thursday 19 February 2026</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Jobs" value={String(openCount)} sub="enquiry / booked / active" color="blue" />
        <StatCard label="Today's Jobs" value={String(todaysJobs.length)} sub="scheduled today" color="orange" />
        <StatCard label="Unpaid Invoices" value={formatCurrency(unpaidTotal)} sub="awaiting payment" color="yellow" />
        <StatCard label="New Enquiries" value={String(enquiryCount)} sub="awaiting booking" color="purple" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's jobs */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Today's Jobs</h2>
            <Link href="/jobs" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {todaysJobs.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No jobs scheduled today.</p>
          ) : (
            <ul className="space-y-3">
              {todaysJobs.map((job) => {
                const customer = customers.find((c) => c.id === job.customer_id)
                const cfg = statusConfig[job.status]
                return (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">{job.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{customer?.full_name} · {job.scheduled_time} · {job.assigned_engineer}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Recent customers */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Customers</h2>
            <Link href="/customers" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <ul className="space-y-3">
            {recentCustomers.map((c) => {
              const jobCount = jobs.filter((j) => j.customer_id === c.id).length
              return (
                <li key={c.id}>
                  <Link href={`/customers/${c.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {c.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">{c.full_name}</p>
                      <p className="text-xs text-gray-500">{c.postcode} · {jobCount} job{jobCount !== 1 ? 's' : ''}</p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {/* All jobs overview */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">All Active Jobs</h2>
          <Link href="/jobs" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Job</th>
                <th className="pb-2 pr-4 font-medium">Customer</th>
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Engineer</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((job) => {
                const customer = customers.find((c) => c.id === job.customer_id)
                const cfg = statusConfig[job.status]
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4">
                      <Link href={`/jobs/${job.id}`} className="font-medium text-gray-900 hover:text-blue-700">{job.title}</Link>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      <Link href={`/customers/${job.customer_id}`} className="hover:text-blue-700">{customer?.full_name}</Link>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">{job.scheduled_date} {job.scheduled_time}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{job.assigned_engineer}</td>
                    <td className="py-2.5">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: 'blue' | 'orange' | 'yellow' | 'purple' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs opacity-60 mt-0.5">{sub}</p>
    </div>
  )
}
