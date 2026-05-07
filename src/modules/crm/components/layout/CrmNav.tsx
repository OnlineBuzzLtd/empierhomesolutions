"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type CrmNavItem = {
  href: string;
  label: string;
  icon: string;
};

export type CrmNavGroup = {
  label: string;
  items: CrmNavItem[];
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CrmSidebarNav({ groups }: { groups: CrmNavGroup[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex-1 space-y-6 px-3 py-5">
      {groups.map((group) => (
        <div key={group.label} className="space-y-0.5">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-l-2 border-emerald-400 bg-slate-800 pl-[10px] text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span aria-hidden className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function CrmTopNav({ items }: { items: CrmNavItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <div className="hidden gap-1 lg:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
