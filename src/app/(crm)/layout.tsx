import type { Metadata } from 'next'
import Link from 'next/link'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Empire CRM',
  description: 'Internal CRM — Empire Home Solutions',
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/customers', label: 'Customers', icon: '👤' },
  { href: '/jobs', label: 'Jobs', icon: '🔧' },
  { href: '/quotes', label: 'Quotes', icon: '📋' },
  { href: '/invoices', label: 'Invoices', icon: '📄' },
]

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden lg:flex lg:flex-col w-56 bg-gray-900 text-white shrink-0">
            <div className="px-5 py-5 border-b border-gray-700">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Empire</p>
              <p className="text-base font-bold text-white leading-tight">Home Solutions</p>
              <span className="inline-block mt-1.5 text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">CRM Demo</span>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="px-5 py-4 border-t border-gray-700">
              <p className="text-xs text-gray-500">Logged in as</p>
              <p className="text-sm font-medium text-white">Shaz Iqbal</p>
              <p className="text-xs text-gray-400">Admin</p>
            </div>
          </aside>

          {/* Main area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile top bar */}
            <header className="lg:hidden flex items-center justify-between bg-gray-900 text-white px-4 py-3">
              <div>
                <p className="text-sm font-bold">Empire CRM</p>
              </div>
              <nav className="flex items-center gap-1">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="px-2 py-1.5 rounded text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                    {item.icon}
                  </Link>
                ))}
              </nav>
            </header>

            <main className="flex-1 p-4 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
