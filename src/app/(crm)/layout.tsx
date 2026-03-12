import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "../globals.css";
import { getCrmSession, userCanManageSettings } from "@/modules/crm/lib/auth";
import { LogoutButton } from "@/modules/crm/components/layout/LogoutButton";
import { getCrmSetupState } from "@/modules/crm/lib/setup";

export const metadata: Metadata = {
  title: "Empire CRM",
  description: "Internal CRM for Empire Home Solutions",
};

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/leads", label: "Leads", icon: "🧲" },
  { href: "/customers", label: "Customers", icon: "👤" },
  { href: "/jobs", label: "Jobs", icon: "🔧" },
  { href: "/calendar", label: "Calendar", icon: "🗓" },
  { href: "/quotes", label: "Quotes", icon: "📋" },
  { href: "/invoices", label: "Invoices", icon: "📄" },
];

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-crm-pathname") ?? "";
  const session = await getCrmSession();
  const setup = getCrmSetupState();
  const navItems = userCanManageSettings(session.profile?.role)
    ? [...baseNavItems, { href: "/settings", label: "Settings", icon: "⚙️" }]
    : baseNavItems;

  if (setup.configured && pathname && pathname !== "/login" && !session.user) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (setup.configured && pathname === "/login" && session.user) {
    redirect("/dashboard");
  }

  if (!session.user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 text-white lg:flex">
          <div className="border-b border-slate-800 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Empire</p>
            <p className="mt-1 text-lg font-bold">Home Solutions CRM</p>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-800 px-5 py-4">
            <p className="text-xs text-slate-500">Logged in as</p>
            <p className="mt-1 text-sm font-semibold text-white">{session.profile?.full_name ?? session.user.email}</p>
            <p className="text-xs capitalize text-slate-400">{session.profile?.role ?? "user"}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
              <div>
                <p className="text-sm font-semibold text-slate-900">Empire CRM</p>
                <p className="text-xs text-slate-500">{session.profile?.full_name ?? session.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden gap-1 lg:flex">
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                      {item.label}
                    </Link>
                  ))}
                </div>
                <LogoutButton />
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
