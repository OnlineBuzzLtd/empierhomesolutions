import Link from "next/link";
import type { ReactNode } from "react";

export type WorkItemPriority = "high" | "medium" | "normal";

export function WorkItemRow({
  title,
  detail,
  badge,
  label,
  href,
  action,
  actions,
  priority = "normal",
  value,
  secondary,
  meta,
  status,
  className = "",
  highlightedMarker,
}: {
  title: string;
  detail: string;
  badge: string;
  label: string;
  href?: string;
  action?: string;
  actions?: ReactNode;
  priority?: WorkItemPriority;
  value?: string;
  secondary?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  className?: string;
  highlightedMarker?: boolean;
}) {
  return (
    <div
      data-highlighted-enquiry={highlightedMarker ? "true" : undefined}
      className={`flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              priority === "high"
                ? "bg-rose-100 text-rose-700"
                : priority === "medium"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {badge}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{detail}</p>
        {meta ? <div className="mt-3">{meta}</div> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">
        {status}
        {value ? <span className="text-sm font-semibold text-slate-900">{value}</span> : null}
        {secondary}
        {actions ??
          (href && action ? (
            <Link
              href={href}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {action}
            </Link>
          ) : null)}
      </div>
    </div>
  );
}
