"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  Wrench,
  Users,
  FileText,
  ReceiptText,
  Bot,
  LogOut,
  Menu,
  X,
  Trash2,
} from "lucide-react";
import { useDemoStore } from "../store";

const NAV = [
  { href: "/try/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/try/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/try/jobs", label: "Jobs", icon: Wrench },
  { href: "/try/scheduler", label: "Scheduler", icon: CalendarDays },
  { href: "/try/customers", label: "Customers", icon: Users },
  { href: "/try/quotes", label: "Quotes", icon: FileText },
  { href: "/try/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/try/agents", label: "AI Receptionist", icon: Bot },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-cyan-100 text-cyan-800" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon size={17} strokeWidth={2} />
            {item.label}
            {item.href === "/try/agents" ? (
              <span className="ml-auto rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                5
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function DemoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { runningAgent, clearAll } = useDemoStore();

  async function logout() {
    await fetch("/api/try/logout", { method: "POST" });
    router.push("/try/login");
  }

  function handleClearAll() {
    if (runningAgent) return;
    const ok = window.confirm(
      "Delete all demo data?\n\nThis wipes every enquiry, booking, job, quote, and invoice so you can test fresh records. The team stays. This cannot be undone.",
    );
    if (ok) clearAll();
  }

  const Brand = (
    <div className="flex items-center gap-2 px-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-sm font-black text-slate-950">
        E
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">Empire Heating</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Field Service CRM</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-950 py-5 lg:flex">
        {Brand}
        <div className="mt-6 flex-1 px-3">
          <NavLinks pathname={pathname} />
        </div>
        <div className="mt-auto space-y-2 px-3">
          <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">demo@empirecrm.test</p>
            <p className="mt-0.5 inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> Demo data
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-slate-950 py-5">
            <div className="flex items-center justify-between pr-3">
              {Brand}
              <button type="button" onClick={() => setMobileOpen(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex-1 px-3">
              <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
            <button
              type="button"
              onClick={logout}
              className="mx-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <LogOut size={17} /> Sign out
            </button>
          </aside>
        </div>
      ) : null}

      {/* Content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                Demo workspace
              </span>
              {runningAgent ? (
                <span className="hidden items-center gap-2 text-xs font-medium text-cyan-700 sm:flex">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
                  Agent running…
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={Boolean(runningAgent)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Delete all demo data for a fresh start"
              >
                <Trash2 size={14} /> Clear all data
              </button>
              <Link
                href="/try/agents"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Run an AI agent
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
