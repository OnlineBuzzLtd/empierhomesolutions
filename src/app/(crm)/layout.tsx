import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "../globals.css";
import { DemoPanel } from "@/modules/crm/components/demo/DemoPanel";
import { DemoModeProvider } from "@/modules/crm/components/demo/DemoModeProvider";
import { DemoModeToggle } from "@/modules/crm/components/demo/DemoModeToggle";
import { getAddonState } from "@/modules/crm/lib/addons";
import { getCrmSession, userCanManageSettings } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { LogoutButton } from "@/modules/crm/components/layout/LogoutButton";
import { TenantSwitcher } from "@/modules/crm/components/layout/TenantSwitcher";
import { getCrmSetupState } from "@/modules/crm/lib/setup";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getCrmSession();
  const displayName = session.branding?.crm_display_name ?? (session.tenant ? `${session.tenant.name} CRM` : "Field Service CRM");
  const businessName = session.branding?.business_name ?? session.tenant?.name ?? "your business";

  return {
    title: displayName,
    description: `Internal CRM for ${businessName}`,
  };
}

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/leads", label: "Leads", icon: "🧲" },
  { href: "/customers", label: "Customers", icon: "👤" },
  { href: "/jobs", label: "Jobs", icon: "🔧" },
  { href: "/calendar", label: "Calendar", icon: "🗓" },
  { href: "/ai-hub", label: "AI Hub", icon: "🤖", locked: true },
  { href: "/quotes", label: "Quotes", icon: "📋" },
  { href: "/invoices", label: "Invoices", icon: "📄" },
  { href: "/staff", label: "Staff", icon: "🪪" },
];

const engineerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/jobs", label: "Jobs", icon: "🔧" },
  { href: "/calendar", label: "Calendar", icon: "🗓" },
];

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-crm-pathname") ?? "";
  const [session, aiHubAddon] = await Promise.all([getCrmSession(), getAddonState("ai_comms_hub")]);
  const demoState = await getCrmDemoState();
  const setup = getCrmSetupState();
  const canManageDemo = userCanManageSettings(session.profile?.role) && !session.profile?.is_demo && session.settings?.demo_mode_enabled !== false;
  const isEngineer = session.profile?.role === "engineer";
  const navItems = isEngineer
    ? engineerNavItems
    : userCanManageSettings(session.profile?.role)
      ? [...baseNavItems, { href: "/reports", label: "Reports", icon: "📈" }, { href: "/settings", label: "Settings", icon: "⚙️" }]
      : baseNavItems;
  const modeBadgeClassName = demoState.active ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  const modeBadgeLabel = demoState.locked ? "Demo Account" : demoState.active ? "Demo Data" : "Live Data";
  const crmDisplayName = session.branding?.crm_display_name ?? (session.tenant ? `${session.tenant.name} CRM` : "Field Service CRM");
  const businessName = session.branding?.business_name ?? session.tenant?.name ?? "CRM";
  const tenantOptions = session.memberships.map((membership) => ({
    id: membership.tenant_id,
    name: membership.tenant?.name ?? membership.tenant_id,
  }));

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
    <DemoModeProvider state={demoState}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 text-white lg:flex">
            <div className="border-b border-slate-800 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">{businessName}</p>
              <p className="mt-1 text-lg font-bold">{crmDisplayName}</p>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.href === "/ai-hub" && !aiHubAddon.enabled ? (
                    <span className="ml-auto rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                      Add-on
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
            <div className="border-t border-slate-800 px-5 py-4">
              <p className="text-xs text-slate-500">Logged in as</p>
              <p className="mt-1 text-sm font-semibold text-white">{session.profile?.full_name ?? session.user.email}</p>
              <p className="text-xs capitalize text-slate-400">{session.profile?.role ?? "user"}</p>
              <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${demoState.active ? "bg-amber-400/20 text-amber-300" : "bg-slate-800 text-slate-300"}`}>
                {modeBadgeLabel}
              </p>
              {demoState.locked ? <p className="mt-2 text-xs text-slate-400">This login is pinned to demo records only.</p> : null}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-b border-slate-200 bg-white">
              <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{crmDisplayName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-slate-500">{session.profile?.full_name ?? session.user.email}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${modeBadgeClassName}`}>
                      {modeBadgeLabel}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.tenant && tenantOptions.length > 1 ? <TenantSwitcher activeTenantId={session.tenant.id} options={tenantOptions} /> : null}
                  <div className="hidden gap-1 lg:flex">
                    {navItems.map((item) => (
                      <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                        <span className="inline-flex items-center gap-2">
                          <span>{item.label}</span>
                          {item.href === "/ai-hub" && !aiHubAddon.enabled ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                              Add-on
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <DemoModeToggle canManage={canManageDemo} />
                  <LogoutButton />
                </div>
              </div>
            </header>

            <main className={`flex-1 px-4 py-6 lg:px-8 ${isEngineer ? "pb-24 lg:pb-6" : ""}`}>
              <div className="mx-auto w-full max-w-7xl">
                {demoState.active ? (
                  <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {demoState.locked
                      ? "Demo account: you are viewing demo CRM records only."
                      : "Demo data mode is active. Changes here apply to the demo walkthrough only."}
                  </div>
                ) : null}
              </div>
              {children}
            </main>
            {isEngineer ? (
              <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
                  <Link
                    href="/dashboard"
                    className={`rounded-full px-3 py-2 ${pathname === "/dashboard" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700"}`}
                  >
                    Dashboard
                  </Link>
                  <Link href="/dashboard#today-route" className="rounded-full border border-slate-200 px-3 py-2 text-slate-700">
                    Today
                  </Link>
                  <Link
                    href="/jobs"
                    className={`rounded-full px-3 py-2 ${pathname.startsWith("/jobs") ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700"}`}
                  >
                    Jobs
                  </Link>
                  <Link
                    href="/calendar"
                    className={`rounded-full px-3 py-2 ${pathname.startsWith("/calendar") ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700"}`}
                  >
                    Calendar
                  </Link>
                </div>
              </nav>
            ) : null}
            <DemoPanel />
          </div>
        </div>
      </div>
    </DemoModeProvider>
  );
}
