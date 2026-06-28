"use client";

import Link from "next/link";
import { useDemoStore } from "../store";
import type { DemoCrmState } from "../types";
import { AGENT_META, DemoSectionCard, DemoStatusBadge, gbp, shortDateTime, timeAgo } from "./ui";

function engineerName(state: DemoCrmState, id: string | null): string {
  return state.engineers.find((e) => e.id === id)?.name ?? "Unassigned";
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function SourceChip({ agent }: { agent: keyof typeof AGENT_META | null }) {
  if (!agent) return <span className="text-xs text-slate-400">Manual</span>;
  const meta = AGENT_META[agent];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}>
      <Icon size={12} /> {meta.label.replace(" Agent", "")}
    </span>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ?? "text-slate-900"}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function DashboardView() {
  const { state } = useDemoStore();
  const openEnquiries = state.leads.filter((l) => !["completed", "lost"].includes(l.status));
  const today = new Date().toDateString();
  const todaysAppts = state.appointments.filter((a) => new Date(a.start).toDateString() === today);
  const liveJobs = state.jobs.filter((j) => j.status === "booked" || j.status === "in_progress");
  const overdue = state.invoices.filter((i) => i.status === "overdue");
  const overdueTotal = overdue.reduce((sum, i) => sum + i.amountGbp, 0);

  return (
    <div>
      <PageHeader title="Dashboard" description="Your live workspace — updated as the AI agents work." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Open enquiries" value={String(openEnquiries.length)} hint="Awaiting action" />
        <Kpi label="Appointments today" value={String(todaysAppts.length)} hint="Across the team" />
        <Kpi label="Live jobs" value={String(liveJobs.length)} hint="Booked or in progress" />
        <Kpi
          label="Overdue invoices"
          value={overdue.length ? gbp(overdueTotal) : "£0"}
          hint={`${overdue.length} outstanding`}
          tone={overdue.length ? "text-rose-600" : "text-slate-900"}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <DemoSectionCard
          title="Latest enquiries"
          description="Newest first"
          action={<Link href="/try/enquiries" className="text-xs font-semibold text-cyan-700 hover:underline">View all</Link>}
        >
          <ul className="divide-y divide-slate-100">
            {state.leads.slice(0, 5).map((lead) => (
              <li key={lead.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{lead.customerName}</p>
                  <p className="truncate text-xs text-slate-500">{lead.service}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SourceChip agent={lead.agent} />
                  <DemoStatusBadge status={lead.status} />
                </div>
              </li>
            ))}
          </ul>
        </DemoSectionCard>

        <DemoSectionCard title="Recent agent activity" description="What the AI receptionist did">
          <ul className="space-y-3">
            {state.activity.slice(0, 6).map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${item.agent ? "bg-cyan-500" : "bg-slate-300"}`} />
                <div>
                  <p className="text-sm leading-snug text-slate-700">{item.text}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{timeAgo(item.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </DemoSectionCard>
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EnquiriesView() {
  const { state } = useDemoStore();
  return (
    <div>
      <PageHeader title="Enquiries" description="Every lead the agents capture lands here, qualified and ready." />
      <Table head={["Customer", "Service", "Source", "Urgency", "Status", "Received"]}>
        {state.leads.map((lead) => (
          <tr key={lead.id} className="hover:bg-slate-50">
            <td className="px-4 py-3">
              <p className="font-medium text-slate-900">{lead.customerName}</p>
              <p className="text-xs text-slate-500">{lead.phone}</p>
            </td>
            <td className="px-4 py-3 text-slate-700">{lead.service}</td>
            <td className="px-4 py-3"><SourceChip agent={lead.agent} /></td>
            <td className="px-4 py-3 capitalize text-slate-600">{lead.urgency}</td>
            <td className="px-4 py-3"><DemoStatusBadge status={lead.status} /></td>
            <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(lead.createdAt)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function SchedulerView() {
  const { state } = useDemoStore();
  const sorted = [...state.appointments].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  return (
    <div>
      <PageHeader title="Scheduler" description="Bookings the agents make appear straight on the diary." />
      <Table head={["When", "Customer", "Type", "Engineer", "Address", "Status"]}>
        {sorted.map((appt) => (
          <tr key={appt.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-900">{shortDateTime(appt.start)}</td>
            <td className="px-4 py-3 text-slate-700">{appt.customerName}</td>
            <td className="px-4 py-3 capitalize text-slate-600">{appt.type}</td>
            <td className="px-4 py-3 text-slate-600">{engineerName(state, appt.engineerId)}</td>
            <td className="px-4 py-3 text-xs text-slate-500">{appt.addressLine}, {appt.postcode}</td>
            <td className="px-4 py-3"><DemoStatusBadge status={appt.status} /></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function JobsView() {
  const { state } = useDemoStore();
  return (
    <div>
      <PageHeader title="Jobs" description="Qualified work, ready for the engineers." />
      <Table head={["Ref", "Customer", "Service", "Engineer", "Value", "Status"]}>
        {state.jobs.map((job) => (
          <tr key={job.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{job.ref}</td>
            <td className="px-4 py-3 font-medium text-slate-900">{job.customerName}</td>
            <td className="px-4 py-3 text-slate-700">{job.service}</td>
            <td className="px-4 py-3 text-slate-600">{engineerName(state, job.engineerId)}</td>
            <td className="px-4 py-3 text-slate-700">{gbp(job.valueGbp)}</td>
            <td className="px-4 py-3"><DemoStatusBadge status={job.status} /></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function InvoicesView() {
  const { state } = useDemoStore();
  return (
    <div>
      <PageHeader title="Invoices" description="The Payments agent chases these until they're settled." />
      <Table head={["Ref", "Customer", "Job", "Amount", "Due", "Status"]}>
        {state.invoices.map((inv) => (
          <tr key={inv.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.ref}</td>
            <td className="px-4 py-3 font-medium text-slate-900">{inv.customerName}</td>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.jobRef}</td>
            <td className="px-4 py-3 text-slate-700">{gbp(inv.amountGbp)}</td>
            <td className="px-4 py-3 text-xs text-slate-500">{inv.dueDate}</td>
            <td className="px-4 py-3"><DemoStatusBadge status={inv.status} /></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function CustomersView() {
  const { state } = useDemoStore();
  return (
    <div>
      <PageHeader title="Customers" description="Your customer records." />
      <Table head={["Name", "Phone", "Email", "Address"]}>
        {state.customers.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
            <td className="px-4 py-3 text-slate-600">{c.phone}</td>
            <td className="px-4 py-3 text-slate-600">{c.email}</td>
            <td className="px-4 py-3 text-xs text-slate-500">{c.addressLine}, {c.postcode}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function QuotesView() {
  const { state } = useDemoStore();
  return (
    <div>
      <PageHeader title="Quotes" description="Quotes raised from enquiries and surveys." />
      <Table head={["Ref", "Customer", "Service", "Total", "Status"]}>
        {state.quotes.map((q) => (
          <tr key={q.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{q.ref}</td>
            <td className="px-4 py-3 font-medium text-slate-900">{q.customerName}</td>
            <td className="px-4 py-3 text-slate-700">{q.service}</td>
            <td className="px-4 py-3 text-slate-700">{gbp(q.totalGbp)}</td>
            <td className="px-4 py-3"><DemoStatusBadge status={q.status} /></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
