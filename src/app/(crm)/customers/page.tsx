import Link from 'next/link'
import { customers, jobs } from '@/modules/crm/lib/mockData'

export default function CustomersPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">{customers.length} total customers</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Add Customer
        </button>
      </div>

      {/* Search bar (UI only in demo) */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Search by name, postcode, or phone..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          readOnly
        />
      </div>

      {/* Customer list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {customers.map((customer) => {
          const jobCount = jobs.filter((j) => j.customer_id === customer.id).length
          const activeJobs = jobs.filter((j) => j.customer_id === customer.id && ['enquiry','booked','in_progress'].includes(j.status)).length
          return (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                {customer.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{customer.full_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{customer.phone} · {customer.address_line1}, {customer.postcode}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">{jobCount} job{jobCount !== 1 ? 's' : ''}</p>
                {activeJobs > 0 && (
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{activeJobs} active</span>
                )}
              </div>
              <span className="text-gray-300 group-hover:text-gray-500">›</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
