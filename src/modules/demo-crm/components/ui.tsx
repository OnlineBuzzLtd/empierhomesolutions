"use client";

import type { ReactNode } from "react";
import { Phone, Globe, MessageCircle, MonitorSmartphone, BadgePoundSterling } from "lucide-react";
import type { DemoAgentId } from "../types";

export function gbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(amount);
}

export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function DemoSectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

const BADGE_TONES: Record<string, string> = {
  // leads
  new: "bg-sky-100 text-sky-700",
  contacted: "bg-indigo-100 text-indigo-700",
  qualified: "bg-violet-100 text-violet-700",
  survey_booked: "bg-amber-100 text-amber-700",
  quoted: "bg-blue-100 text-blue-700",
  booked: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-200 text-slate-700",
  lost: "bg-rose-100 text-rose-700",
  // appointments / jobs
  scheduled: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-amber-100 text-amber-700",
  invoiced: "bg-blue-100 text-blue-700",
  // quotes
  draft: "bg-slate-200 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
  // invoices
  unpaid: "bg-amber-100 text-amber-700",
  overdue: "bg-rose-100 text-rose-700",
  paid: "bg-emerald-100 text-emerald-700",
  void: "bg-slate-200 text-slate-500",
};

export function DemoStatusBadge({ status }: { status: string }) {
  const tone = BADGE_TONES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export const AGENT_META: Record<
  DemoAgentId,
  { label: string; icon: typeof Phone; accent: string; chip: string }
> = {
  voice: { label: "Voice Agent", icon: Phone, accent: "text-cyan-600", chip: "bg-cyan-100 text-cyan-700" },
  lead: { label: "Lead Agent", icon: Globe, accent: "text-indigo-600", chip: "bg-indigo-100 text-indigo-700" },
  messaging: { label: "Messaging Agent", icon: MessageCircle, accent: "text-emerald-600", chip: "bg-emerald-100 text-emerald-700" },
  web_chat: { label: "Web Chat Agent", icon: MonitorSmartphone, accent: "text-violet-600", chip: "bg-violet-100 text-violet-700" },
  payments: { label: "Payments Agent", icon: BadgePoundSterling, accent: "text-amber-600", chip: "bg-amber-100 text-amber-700" },
};
