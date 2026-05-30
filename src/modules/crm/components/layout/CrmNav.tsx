"use client";

import { usePathname } from "next/navigation";
import { CrmInstantLink } from "@/modules/crm/components/client/CrmClientRuntime";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Clapperboard,
  FileText,
  Gauge,
  Inbox,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Package,
  PackageCheck,
  PhoneCall,
  ReceiptText,
  Settings,
  Sparkles,
  UserRound,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type CrmNavIconKey =
  | "dashboard"
  | "leads"
  | "customers"
  | "jobs"
  | "calendar"
  | "quotes"
  | "invoices"
  | "staff"
  | "inbox"
  | "calls"
  | "automations"
  | "ai-settings"
  | "ai-hub"
  | "reports"
  | "settings"
  | "demo"
  | "more"
  | "suppliers"
  | "products"
  | "packages"
  | "templates"
  | "integrations";

export type CrmNavItem = {
  href: string;
  label: string;
  icon: CrmNavIconKey;
  children?: CrmNavItem[];
};

export type CrmNavGroup = {
  label: string;
  items: CrmNavItem[];
};

function isActive(pathname: string, href: string) {
  const hrefPath = href.split(/[?#]/)[0] || href;
  if (hrefPath === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (hrefPath === "/calendar" && pathname.startsWith("/calendar/today")) {
    return false;
  }
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

const navIcons: Record<CrmNavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  leads: Gauge,
  customers: UsersRound,
  jobs: Wrench,
  calendar: CalendarDays,
  quotes: FileText,
  invoices: ReceiptText,
  staff: BriefcaseBusiness,
  inbox: Inbox,
  calls: PhoneCall,
  automations: Sparkles,
  "ai-settings": Settings,
  "ai-hub": Bot,
  reports: BarChart3,
  settings: Settings,
  demo: Clapperboard,
  more: MoreHorizontal,
  suppliers: BriefcaseBusiness,
  products: Package,
  packages: PackageCheck,
  templates: FileText,
  integrations: Settings,
};

function isItemActive(pathname: string, item: CrmNavItem) {
  return isActive(pathname, item.href) || Boolean(item.children?.some((child) => isActive(pathname, child.href)));
}

function NavIcon({ icon, active }: { icon: CrmNavIconKey; active: boolean }) {
  const Icon = navIcons[icon] ?? UserRound;
  return <Icon aria-hidden size={17} strokeWidth={active ? 2.4 : 2} />;
}

export function CrmSidebarNav({ groups }: { groups: CrmNavGroup[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isItemActive(pathname, item);
            if (item.children?.length) {
              return (
                <details key={item.href} className="group/more" open={active}>
                  <summary
                    className={`flex min-h-10 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                      active ? "bg-white text-slate-950 shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${
                        active ? "bg-cyan-100 text-cyan-700" : "bg-white/5 text-slate-400 group-hover/more:text-white"
                      }`}
                    >
                      <NavIcon icon={item.icon} active={active} />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </summary>
                  <div className="mt-1 space-y-1 pl-10">
                    {item.children.map((child) => {
                      const childActive = isActive(pathname, child.href);
                      return (
                        <CrmInstantLink
                          key={child.href}
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={`block rounded-md px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
                            childActive ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {child.label}
                        </CrmInstantLink>
                      );
                    })}
                  </div>
                </details>
              );
            }
            return (
              <CrmInstantLink
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  active
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${
                    active ? "bg-cyan-100 text-cyan-700" : "bg-white/5 text-slate-400 group-hover:text-white"
                  }`}
                >
                  <NavIcon icon={item.icon} active={active} />
                </span>
                <span className="truncate">{item.label}</span>
              </CrmInstantLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function CrmMobileMenu({ groups }: { groups: CrmNavGroup[] }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open CRM menu"
        aria-expanded={open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <Menu size={18} aria-hidden />
      </button>
      {open ? (
        <div className="fixed left-4 right-4 top-20 z-50 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/15">
          {groups.map((group) => (
            <div key={group.label} className="py-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item);
                  if (item.children?.length) {
                    return (
                      <div key={item.href}>
                        <div
                          className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                            active ? "bg-slate-900 text-white" : "text-slate-700"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                              active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <NavIcon icon={item.icon} active={active} />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        <div className="mt-1 space-y-1 pl-10">
                          {item.children.map((child) => {
                            const childActive = isActive(pathname, child.href);
                            return (
                              <CrmInstantLink
                                key={child.href}
                                href={child.href}
                                aria-current={childActive ? "page" : undefined}
                                onClick={() => setOpen(false)}
                                className={`block rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                                  childActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {child.label}
                              </CrmInstantLink>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <CrmInstantLink
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                          active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <NavIcon icon={item.icon} active={active} />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </CrmInstantLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
