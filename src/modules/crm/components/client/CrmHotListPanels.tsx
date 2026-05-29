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

type SearchParams = Record<string, string | string[] | undefined>;
type ListResponse<T> = { ok: true; items: T[]; pagination: CrmPaginationInput };

function apiUrl(path: string, pagination: CrmPaginationInput) {
  const params = new URLSearchParams();
  if (pagination.page) params.set("page", String(pagination.page));
  if (pagination.pageSize) params.set("pageSize", String(pagination.pageSize));
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
      title="Job List"
      demoAnchor="job-record"
      action={
        showCreatePanel ? (
          <Link href="/jobs" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Close form
          </Link>
        ) : (
          <Link href="/jobs?new=1" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Add job
          </Link>
        )
      }
    >
      {!data ? (
        <PanelState error={error} loadingLabel={loading ? "Loading jobs..." : "No jobs loaded."} />
      ) : jobs.length === 0 ? (
        <EmptyState message={demoActive ? "No demo jobs for this walkthrough." : "No jobs yet. Create the first job from the form."} />
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
      title="Customer List"
      demoAnchor="customer-record"
      action={
        showCreatePanel ? (
          <Link href="/customers" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Close form
          </Link>
        ) : (
          <Link href="/customers?new=1" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Add customer
          </Link>
        )
      }
    >
      {!data ? (
        <PanelState error={error} loadingLabel={loading ? "Loading customers..." : "No customers loaded."} />
      ) : customers.length === 0 ? (
        <EmptyState message={demoActive ? "No demo customers for this walkthrough." : "No customers yet. Create the first customer using the form."} />
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
  demoActive,
}: {
  pagination: CrmPaginationInput;
  params: SearchParams;
  showCreatePanel: boolean;
  demoActive: boolean;
}) {
  const { data, error, loading } = useCrmApi<ListResponse<LeadWithRelations>>(apiUrl("/api/crm/leads", pagination));
  const leads = data?.items ?? [];

  return (
    <SectionCard
      title="Lead Pipeline"
      demoAnchor="lead-pipeline"
      action={
        showCreatePanel ? (
          <Link href="/leads" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Close form
          </Link>
        ) : (
          <Link href="/leads?new=1" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Add lead
          </Link>
        )
      }
    >
      {!data ? (
        <PanelState error={error} loadingLabel={loading ? "Loading leads..." : "No leads loaded."} />
      ) : leads.length === 0 ? (
        <EmptyState message={demoActive ? "No demo leads for this walkthrough." : "No leads yet. Add the first lead using the form."} />
      ) : (
        <div data-crm-screen-ready="true" className="space-y-3">
          {leads.map((lead) => {
            const badge = intakeBadge(lead);
            return (
              <div key={lead.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{lead.customer?.full_name ?? "Unlinked lead"}</p>
                      {lead.customer?.id ? (
                        <Link href={`/customers/${lead.customer.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                          Open customer
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {lead.source || "No source"} · {lead.service?.name || "Service TBC"} · {lead.job_type?.name || "Job type TBC"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {badge ? <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span> : null}
                      {lead.intake_source === "website" ? (
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">Website intake</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Next action {formatRelativeTime(lead.next_action_at)}</p>
                  </div>
                  <StatusBadge config={leadStatusConfig[lead.status]} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data ? <PaginationControls basePath="/leads" itemCount={leads.length} pagination={pagination} searchParams={params} /> : null}
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
      title="Quote List"
      demoAnchor="quote-record"
      action={
        showCreatePanel ? (
          <Link href="/quotes" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Close form
          </Link>
        ) : (
          <Link href="/quotes?new=1" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Create quote
          </Link>
        )
      }
    >
      {!data ? (
        <PanelState error={error} loadingLabel={loading ? "Loading quotes..." : "No quotes loaded."} />
      ) : quotes.length === 0 ? (
        <EmptyState message={demoActive ? "No demo quotes for this walkthrough." : "No quotes yet."} />
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unpaid</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalUnpaid)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      <SectionCard title="Invoice List" demoAnchor="invoice-record">
        {!data ? (
          <PanelState error={error} loadingLabel={loading ? "Loading invoices..." : "No invoices loaded."} />
        ) : invoices.length === 0 ? (
          <EmptyState message={demoActive ? "No demo invoices for this walkthrough." : "No invoices yet."} />
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
