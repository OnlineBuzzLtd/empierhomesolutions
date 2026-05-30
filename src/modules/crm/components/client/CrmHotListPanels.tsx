"use client";

import Link from "next/link";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { PaginationControls } from "@/modules/crm/components/shared/PaginationControls";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { useCrmApi } from "@/modules/crm/components/client/CrmClientRuntime";
import { formatCurrency, formatDate, formatRelativeTime } from "@/modules/crm/lib/format";
import {
  invoiceStatusConfig,
  jobStatusConfig,
  leadStatusConfig,
  quoteStatusConfig,
} from "@/modules/crm/lib/status";
import type {
  CustomerWithCounts,
  InvoiceWithRelations,
  JobWithRelations,
  LeadWithRelations,
  QuoteWithRelations,
} from "@/modules/crm/types";
import type { CrmPaginationInput } from "@/modules/crm/lib/performance";
import type { BookingRecoveryCase } from "@/modules/platform/lib/booking-recovery";

type SearchParams = Record<string, string | string[] | undefined>;
type ListResponse<T> = { ok: true; items: T[]; pagination: CrmPaginationInput };
type EnquiryListResponse = ListResponse<LeadWithRelations> & {
  counts: {
    todoCount: number;
    doneCount: number;
    allCount: number;
  };
  recoveryCases: BookingRecoveryCase[];
  visibleCount: number;
};

function apiUrl(path: string, pagination: CrmPaginationInput) {
  const params = new URLSearchParams();
  if (pagination.page) params.set("page", String(pagination.page));
  if (pagination.pageSize) params.set("pageSize", String(pagination.pageSize));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function apiUrlWithParams(path: string, pagination: CrmPaginationInput, extra: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  if (pagination.page) params.set("page", String(pagination.page));
  if (pagination.pageSize) params.set("pageSize", String(pagination.pageSize));
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function PanelState({
  error,
  loadingLabel,
}: {
  error: string | null;
  loadingLabel: string;
}) {
  if (error) {
    return <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
  }

  return <p className="text-sm text-slate-500">{loadingLabel}</p>;
}

function StatusTabs({ tabs, active, basePath }: { tabs: string[]; active: string; basePath: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
      {tabs.map((tab) => {
        const key = tab.toLowerCase();
        const href = key === "all" ? basePath : `${basePath}?status=${key}`;
        const selected = active.toLowerCase() === key || (key === "all" && active.toLowerCase() === "all");
        return (
          <Link
            key={tab}
            href={href}
            className={`rounded-full px-3 py-1.5 ${
              selected ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab}
          </Link>
        );
      })}
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseEnquiryTab(params: SearchParams) {
  const tab = firstParam(params.tab);
  return tab === "done" || tab === "all" ? tab : "todo";
}

function EnquiryTabs({
  active,
  counts,
}: {
  active: "todo" | "done" | "all";
  counts: EnquiryListResponse["counts"] | null;
}) {
  const tabs = [
    { key: "todo", label: "To-do", count: counts?.todoCount ?? 0 },
    { key: "done", label: "Done", count: counts?.doneCount ?? 0 },
    { key: "all", label: "All", count: counts?.allCount ?? 0 },
  ] as const;
  return (
    <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === "todo" ? "/leads?tab=todo" : `/leads?tab=${tab.key}`}
          className={`rounded-full px-3 py-1.5 ${
            active === tab.key ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {tab.label} <span className="ml-1 opacity-75">{tab.count}</span>
        </Link>
      ))}
    </div>
  );
}

function enquiryEmptyMessage(activeTab: "todo" | "done" | "all") {
  if (activeTab === "todo") {
    return "No enquiries need action. New customer requests will appear here.";
  }
  if (activeTab === "done") {
    return "No completed enquiries yet. Booked or closed enquiries will appear here.";
  }
  return "No enquiries yet. Add one manually or connect your website form.";
}

function formatRecoveryDate(startsAt: string | null, endsAt: string | null) {
  if (!startsAt) {
    return "Time TBC";
  }
  const start = formatDate(startsAt);
  return endsAt ? `${start} · ${new Date(startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : start;
}

export function JobsClientPanel({
  pagination,
  params,
  showCreatePanel,
  demoActive,
}: {
  pagination: CrmPaginationInput;
  params: SearchParams;
  showCreatePanel: boolean;
  demoActive: boolean;
}) {
  const { data, error, loading } = useCrmApi<ListResponse<JobWithRelations>>(apiUrl("/api/crm/jobs", pagination));
  const jobs = data?.items ?? [];

  return (
    <SectionCard
      title="Jobs"
      demoAnchor="job-record"
      action={
        showCreatePanel ? (
          <Link href="/jobs" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Close form
          </Link>
        ) : (
          <Link href="/jobs?new=1" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            New Job
          </Link>
        )
      }
    >
      {!data ? (
        <PanelState error={error} loadingLabel={loading ? "Loading jobs..." : "No jobs loaded."} />
      ) : jobs.length === 0 ? (
        <EmptyState message={demoActive ? "No demo jobs for this walkthrough." : "No jobs yet. Create a job when work is ready to schedule."} />
      ) : (
        <div data-crm-screen-ready="true" className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-start justify-between gap-4 px-4 py-4 hover:bg-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {job.customer?.full_name ?? "Customer"} · {job.site?.label ?? job.service?.name ?? "Service"} ·{" "}
                  {job.scheduled_date ?? "TBC"}
                </p>
              </div>
              <StatusBadge config={jobStatusConfig[job.status]} />
            </Link>
          ))}
        </div>
      )}
      {data ? <PaginationControls basePath="/jobs" itemCount={jobs.length} pagination={pagination} searchParams={params} /> : null}
    </SectionCard>
  );
}

export function CustomersClientPanel({
  pagination,
  params,
  showCreatePanel,
  demoActive,
}: {
  pagination: CrmPaginationInput;
  params: SearchParams;
  showCreatePanel: boolean;
  demoActive: boolean;
}) {
  const { data, error, loading } = useCrmApi<ListResponse<CustomerWithCounts>>(apiUrl("/api/crm/customers", pagination));
  const customers = data?.items ?? [];

  return (
    <SectionCard
      title="Customers"
      demoAnchor="customer-record"
      action={
        showCreatePanel ? (
          <Link href="/customers" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Close form
          </Link>
        ) : (
          <Link href="/customers?new=1" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            New Customer
          </Link>
        )
      }
    >
      {!data ? (
        <PanelState error={error} loadingLabel={loading ? "Loading customers..." : "No customers loaded."} />
      ) : customers.length === 0 ? (
        <EmptyState message={demoActive ? "No demo customers for this walkthrough." : "No customers yet. Add a customer when you have someone to quote or book."} />
      ) : (
        <div data-crm-screen-ready="true" className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {customers.map((customer) => (
            <Link key={customer.id} href={`/customers/${customer.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-900">{customer.full_name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {customer.phone || "No phone"} · {customer.postcode || "No postcode"}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{customer.job_count} total jobs</p>
                <p>{customer.active_job_count} active</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {data ? <PaginationControls basePath="/customers" itemCount={customers.length} pagination={pagination} searchParams={params} /> : null}
    </SectionCard>
  );
}

function intakeBadge(lead: LeadWithRelations) {
  if (lead.customer_match_result === "possible_duplicate") {
    return { label: "Possible duplicate", className: "bg-amber-100 text-amber-800" };
  }
  if (lead.customer_match_result === "matched") {
    return { label: "Matched existing customer", className: "bg-slate-100 text-slate-700" };
  }
  if (lead.customer_match_result === "new") {
    return { label: "New customer created", className: "bg-emerald-100 text-emerald-700" };
  }
  return null;
}

export function LeadsClientPanel({
  pagination,
  params,
  showCreatePanel,
}: {
  pagination: CrmPaginationInput;
  params: SearchParams;
  showCreatePanel: boolean;
}) {
  const activeTab = parseEnquiryTab(params);
  const { data, error, loading } = useCrmApi<EnquiryListResponse>(
    apiUrlWithParams("/api/crm/leads", pagination, { tab: activeTab }),
  );
  const leads = data?.items ?? [];
  const recoveryCases = data?.recoveryCases ?? [];
  const visibleCount = data?.visibleCount ?? leads.length + recoveryCases.length;

  return (
    <SectionCard
      title="Enquiries"
      demoAnchor="lead-pipeline"
      action={
        showCreatePanel ? (
          <Link href="/leads" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Close form
          </Link>
        ) : (
          <Link href="/leads?new=1" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            New Enquiry
          </Link>
        )
      }
    >
      <EnquiryTabs active={activeTab} counts={data?.counts ?? null} />
      {!data ? (
        <PanelState error={error} loadingLabel={loading ? "Loading enquiries..." : "No enquiries loaded."} />
      ) : visibleCount === 0 ? (
        <EmptyState message={enquiryEmptyMessage(activeTab)} />
      ) : (
        <div data-crm-screen-ready="true" className="space-y-3">
          {recoveryCases.map((item) => (
            <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.customerName ?? "AI booking needs review"}</p>
                    <Link href="/ai-hub?tab=needs-review" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                      Open AI Receptionist
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {item.service ?? "Booking"} · {item.channel ?? "AI Receptionist"} · {formatRecoveryDate(item.startsAt, item.endsAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[item.phone, item.email, item.address, item.postcode].filter(Boolean).join(" · ") || "No contact details"}
                  </p>
                  <p className="mt-2 text-xs text-amber-800">{item.reason}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Needs review</span>
              </div>
            </div>
          ))}
          {leads.map((lead) => {
            const badge = intakeBadge(lead);
            const contact = [lead.customer?.phone, lead.customer?.email].filter(Boolean).join(" · ");
            const nextAction = lead.next_action_at ? formatRelativeTime(lead.next_action_at) : null;
            return (
              <div key={lead.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{lead.customer?.full_name ?? "Unlinked enquiry"}</p>
                      {lead.customer?.id ? (
                        <Link href={`/customers/${lead.customer.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                          Open customer
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {contact || "No phone or email"} · {lead.source || "No source"} · Received {formatDate(lead.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {lead.service?.name || "Service TBC"} · {lead.job_type?.name || "Job type TBC"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {badge ? <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span> : null}
                      {lead.intake_source === "website" ? (
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">Website intake</span>
                      ) : null}
                    </div>
                    {nextAction ? <p className="mt-1 text-xs text-slate-500">Next action {nextAction}</p> : null}
                  </div>
                  <StatusBadge config={leadStatusConfig[lead.status]} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data ? <PaginationControls basePath="/leads" itemCount={visibleCount} pagination={pagination} searchParams={params} /> : null}
    </SectionCard>
  );
}

export function QuotesClientPanel({
  pagination,
  params,
  showCreatePanel,
  demoActive,
}: {
  pagination: CrmPaginationInput;
  params: SearchParams;
  showCreatePanel: boolean;
  demoActive: boolean;
}) {
  const { data, error, loading } = useCrmApi<ListResponse<QuoteWithRelations>>(apiUrl("/api/crm/quotes", pagination));
  const quotes = data?.items ?? [];

  return (
    <SectionCard
      title="Quotes"
      demoAnchor="quote-record"
      action={
        showCreatePanel ? (
          <Link href="/quotes" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Close form
          </Link>
        ) : (
          <Link href="/quotes?new=1" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            New Quote
          </Link>
        )
      }
    >
      <StatusTabs
        tabs={["Draft", "Sent", "Accepted", "Declined", "All"]}
        active={typeof params.status === "string" ? params.status : "all"}
        basePath="/quotes"
      />
      {!data ? (
        <PanelState error={error} loadingLabel={loading ? "Loading quotes..." : "No quotes loaded."} />
      ) : quotes.length === 0 ? (
        <EmptyState message={demoActive ? "No demo quotes for this walkthrough." : "No quotes yet. Create one from a job or start a blank quote."} />
      ) : (
        <div data-crm-screen-ready="true" className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {quotes.map((quote) => (
            <Link key={quote.id} href={`/quotes/${quote.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-900">{quote.quote_number}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {(quote.document_type === "estimate" ? "Estimate" : "Quote")} · {quote.customer?.full_name ?? "Customer"} ·{" "}
                  {quote.job?.title ?? "Job"} · v{quote.current_version_number} · Valid until {formatDate(quote.valid_until)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge config={quoteStatusConfig[quote.status]} />
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(quote.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {data ? <PaginationControls basePath="/quotes" itemCount={quotes.length} pagination={pagination} searchParams={params} /> : null}
    </SectionCard>
  );
}

export function InvoicesClientPanel({
  pagination,
  params,
  demoActive,
}: {
  pagination: CrmPaginationInput;
  params: SearchParams;
  demoActive: boolean;
}) {
  const { data, error, loading } = useCrmApi<ListResponse<InvoiceWithRelations>>(apiUrl("/api/crm/invoices", pagination));
  const invoices = data?.items ?? [];
  const totalUnpaid = invoices.filter((invoice) => invoice.status === "unpaid").reduce((sum, invoice) => sum + invoice.total, 0);
  const totalPaid = invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <div data-crm-screen-ready={data ? "true" : undefined} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unpaid total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalUnpaid)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid this month</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      <SectionCard
        title="Invoices"
        demoAnchor="invoice-record"
        action={
          <Link href="/jobs" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            New Invoice
          </Link>
        }
      >
        <StatusTabs
          tabs={["Draft", "Unpaid", "Overdue", "Paid", "All"]}
          active={typeof params.status === "string" ? params.status : "all"}
          basePath="/invoices"
        />
        {!data ? (
          <PanelState error={error} loadingLabel={loading ? "Loading invoices..." : "No invoices loaded."} />
        ) : invoices.length === 0 ? (
          <EmptyState message={demoActive ? "No demo invoices for this walkthrough." : "No invoices yet. Create one from a completed job or start a blank invoice."} />
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {invoices.map((invoice) => (
              <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{invoice.invoice_number}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {invoice.customer?.full_name ?? "Customer"} · {invoice.job?.title ?? "Job"} · Due {formatDate(invoice.due_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge config={invoiceStatusConfig[invoice.status]} />
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(invoice.total)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {data ? <PaginationControls basePath="/invoices" itemCount={invoices.length} pagination={pagination} searchParams={params} /> : null}
      </SectionCard>
    </div>
  );
}
