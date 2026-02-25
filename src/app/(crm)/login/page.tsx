import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Empire</p>
          <h1 className="text-2xl font-bold text-white">Home Solutions CRM</h1>
          <p className="text-sm text-gray-400 mt-2">Internal team access only</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email"
              defaultValue="shaz@empirehomesolutions.co.uk"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
            <input
              type="password"
              defaultValue="••••••••"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Link
            href="/dashboard"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg text-center transition-colors"
          >
            Sign In
          </Link>
          <p className="text-center text-xs text-gray-400">
            Demo mode — click Sign In to explore
          </p>
        </div>
      </div>
    </div>
  )
}
