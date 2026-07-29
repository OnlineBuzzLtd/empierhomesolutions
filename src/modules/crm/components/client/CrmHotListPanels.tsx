"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { DeleteTrailButton } from "@/modules/crm/components/client/DeleteTrailButton";
import { PaginationControls } from "@/modules/crm/components/shared/PaginationControls";
import { CustomerPromiseStrip } from "@/modules/crm/components/shared/CustomerPromiseStrip";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { WorkItemRow } from "@/modules/crm/components/shared/WorkItemRow";
import { useCrmApi } from "@/modules/crm/components/client/CrmClientRuntime";
import { buildBookingConfidence, type BookingConfidence } from "@/modules/crm/lib/booking-confidence";
import { buildLeadPromiseSummary, choosePromiseSummary } from "@/modules/crm/lib/customer-promise";
import { formatCurrency, formatDate } from "@/modules/crm/lib/format";
import { getEnquiryWorkItemSummary } from "@/modules/crm/lib/enquiry-work-item";
import { buildMoneyQueue, type MoneyQueueItem } from "@/modules/crm/lib/money-queue";
import {
  invoiceStatusConfig,
  jobStatusConfig,
  leadStatusConfig,
  quoteStatusConfig,
} from "@/modules/crm/lib/status";
import type {
  CustomerWithCounts,
  InvoiceWithRelations,
  JobType,
  JobWithRelations,
  LeadWithRelations,
  QuoteWithRelations,
  Service,
  UserProfile,
} from "@/modules/crm/types";
import type { CrmPaginationInput } from "@/modules/crm/lib/performance";

type SearchParams = Record<string, string | string[] | undefined>;
type ListResponse<T> = { ok: true; items: T[]; pagination: CrmPaginationInput };
type EnquiryListResponse = ListResponse<LeadWithRelations> & {
  counts: {
    todoCount: number;
    doneCount: number;
    allCount: number;
  };
  lookups: {
    customers: CustomerWithCounts[];
    services: Service[];
    jobTypes: JobType[];
    engineers: UserProfile[];
    users: UserProfile[];
  };
  visibleCount: number;
};
type SelectedEnquiry = { kind: "lead"; lead: LeadWithRelations };

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

function telHref(phone: string | null | undefined) {
  const cleaned = phone?.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

function defaultJobTitle(lead: LeadWithRelations) {
  const service = lead.service?.name ?? lead.job_type?.name ?? "Job";
  const customer = lead.customer?.full_name ?? "customer";
  return `${service} for ${customer}`;
}

async function postJson(endpoint: string, payload: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
  const response = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({ error: "Unexpected response." }));
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? "Request failed.");
  }
  return body as Record<string, unknown>;
}

function EnquiryDrawer({
  selected,
  lookups,
  onClose,
  onChanged,
}: {
  selected: SelectedEnquiry | null;
  lookups: EnquiryListResponse["lookups"];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; jobId?: string } | null>(null);

  if (!selected) {
    return null;
  }

  async function runAction(action: () => Promise<Record<string, unknown>>, successMessage: string) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await action();
      const job = result.job as { id?: string } | undefined;
      setSuccess({ message: successMessage, jobId: job?.id });
      onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLeadBooking(formData: FormData, lead: LeadWithRelations) {
    const sendConfirmation = formData.get("send_confirmation") === "on";
    const payload = {
      customer_id: String(formData.get("customer_id") ?? ""),
      service_id: String(formData.get("service_id") ?? ""),
      job_type_id: String(formData.get("job_type_id") ?? ""),
      title: String(formData.get("title") ?? ""),
      scheduled_date: String(formData.get("scheduled_date") ?? ""),
      scheduled_time: String(formData.get("scheduled_time") ?? ""),
      duration_hours: String(formData.get("duration_hours") ?? "1"),
      assigned_engineer_ids: formData.getAll("assigned_engineer_ids").map(String),
      send_confirmation: sendConfirmation,
      confirmation_channels: sendConfirmation ? formData.getAll("confirmation_channels").map(String) : [],
      duplicate_resolution_confirmed: formData.get("duplicate_resolution_confirmed") === "on",
    };
    return postJson(`/api/crm/leads/${lead.id}/confirm-booking`, payload);
  }

  async function patchLead(lead: LeadWithRelations, payload: Record<string, unknown>, message: string) {
    await runAction(() => postJson(`/api/crm/leads/${lead.id}`, payload, "PATCH"), message);
  }

  const title = selected.lead.customer?.full_name ?? "Unlinked enquiry";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30">
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review enquiry</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <LeadBookingDrawerContent
            lead={selected.lead}
            lookups={lookups}
            submitting={submitting}
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void runAction(() => submitLeadBooking(new FormData(form), selected.lead), "Booking confirmed.");
            }}
            onMarkFollowUp={() => patchLead(selected.lead, { status: "follow_up" }, "Marked for follow-up.")}
            onMarkLost={() => patchLead(selected.lead, { status: "lost" }, "Marked lost.")}
          />

          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Danger Zone</p>
            <DeleteTrailButton
              compact
              rootType="lead"
              rootId={selected.lead.id}
              onDeleted={onChanged}
            />
          </div>

          {success ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-semibold">{success.message}</p>
              {success.jobId ? (
                <Link href={`/jobs/${success.jobId}`} className="mt-1 inline-flex text-sm font-semibold text-emerald-900 underline">
                  Open booked job
                </Link>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        </div>
      </aside>
    </div>
  );
}

function LeadBookingDrawerContent({
  lead,
  lookups,
  submitting,
  onSubmit,
  onMarkFollowUp,
  onMarkLost,
}: {
  lead: LeadWithRelations;
  lookups: EnquiryListResponse["lookups"];
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onMarkFollowUp: () => void;
  onMarkLost: () => void;
}) {
  const callHref = telHref(lead.customer?.phone);
  const duplicateNeedsReview = lead.customer_match_result === "possible_duplicate" && Boolean(lead.possible_duplicate_customer_id);
  const bookingConfidence = buildBookingConfidence(lead, { engineerCount: lookups.engineers.length });
  const promise = choosePromiseSummary(lead.promises ?? [], buildLeadPromiseSummary(lead));

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <InfoLine label="Contact" value={[lead.customer?.phone, lead.customer?.email].filter(Boolean).join(" · ") || "No contact details"} />
        <InfoLine label="Address" value={[lead.customer?.address_line1, lead.customer?.postcode].filter(Boolean).join(", ") || "Address not set"} />
        <InfoLine label="Problem" value={lead.problem_description || lead.notes || "No problem description added."} />
        <InfoLine label="Preferred" value={[lead.preferred_date_text, lead.preferred_time_window].filter(Boolean).join(" · ") || "No preference captured"} />
      </div>

      <CustomerPromiseStrip
        promise={promise}
        editContext={{
          customerId: lead.customer_id,
          leadId: lead.id,
          users: lookups.users,
          invalidatePaths: ["/api/crm/leads", "/api/crm/dashboard/summary"],
        }}
      />

      <BookingConfidencePanel confidence={bookingConfidence} />

      {duplicateNeedsReview ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Possible duplicate customer</p>
          <p className="mt-1">Check the customer before confirming this booking.</p>
          {lead.possible_duplicate_customer ? (
            <p className="mt-2 text-xs">
              Possible match: {lead.possible_duplicate_customer.full_name} ·{" "}
              {[lead.possible_duplicate_customer.phone, lead.possible_duplicate_customer.email].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
            <input name="duplicate_resolution_confirmed" type="checkbox" className="h-4 w-4" />
            I checked and selected the correct customer
          </label>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</span>
          <select name="customer_id" defaultValue={lead.customer_id ?? ""} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select customer...</option>
            {lookups.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name} · {customer.postcode || "No postcode"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Job title</span>
          <input name="title" defaultValue={defaultJobTitle(lead)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span>
          <select name="service_id" defaultValue={lead.service_id ?? ""} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select service...</option>
            {lookups.services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Job type</span>
          <select name="job_type_id" defaultValue={lead.job_type_id ?? ""} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select job type...</option>
            {lookups.jobTypes.map((jobType) => (
              <option key={jobType.id} value={jobType.id}>
                {jobType.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
          <input name="scheduled_date" type="date" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Time</span>
          <input name="scheduled_time" type="time" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Duration hours</span>
          <input name="duration_hours" type="number" min="0.25" step="0.25" defaultValue="1" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Engineer</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {lookups.engineers.length === 0 ? <p className="text-sm text-slate-500">No active engineers available.</p> : null}
          {lookups.engineers.map((engineer) => (
            <label key={engineer.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" name="assigned_engineer_ids" value={engineer.id} className="h-4 w-4" />
              <span>{engineer.full_name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <input name="send_confirmation" type="checkbox" className="h-4 w-4" />
          Send customer confirmation now
        </label>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="confirmation_channels" value="sms" className="h-4 w-4" />
            SMS
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="confirmation_channels" value="email" className="h-4 w-4" />
            Email
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
          {submitting ? "Confirming..." : "Confirm Booking"}
        </button>
        {callHref ? (
          <a href={callHref} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Call
          </a>
        ) : null}
        {lead.customer?.id ? (
          <Link href={`/customers/${lead.customer.id}`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Open customer
          </Link>
        ) : null}
        <button type="button" disabled={submitting} onClick={onMarkFollowUp} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Mark follow-up
        </button>
        <button type="button" disabled={submitting} onClick={onMarkLost} className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
          Mark lost
        </button>
      </div>
    </form>
  );
}

function BookingConfidencePanel({ confidence }: { confidence: BookingConfidence }) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm ${
        confidence.level === "ready"
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : confidence.level === "needs_info"
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-rose-200 bg-rose-50 text-rose-950"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Booking check</p>
          <p className="mt-1">{confidence.summary}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            confidence.level === "ready"
              ? "bg-emerald-100 text-emerald-800"
              : confidence.level === "needs_info"
                ? "bg-amber-100 text-amber-800"
                : "bg-rose-100 text-rose-800"
          }`}
        >
          {confidence.label}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {confidence.checks.map((check) => (
          <div key={check.label} className="rounded-lg bg-white/70 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide">{check.label}</p>
            <p className="mt-1 text-xs leading-5">{check.detail}</p>
          </div>
        ))}
      </div>
      {confidence.suggestedWindows.length > 0 ? (
        <div className="mt-3 rounded-lg bg-white/70 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide">Suggested windows</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {confidence.suggestedWindows.map((window) => (
              <span key={window} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold shadow-sm">
                {window}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
    </div>
  );
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
  const createHref = `/leads?tab=${activeTab}&new=1`;
  const closeCreateHref = `/leads?tab=${activeTab}`;
  const highlightedLeadId = firstParam(params.highlight) ?? null;
  const { data, error, loading, refresh } = useCrmApi<EnquiryListResponse>(
    apiUrlWithParams("/api/crm/leads", pagination, { tab: activeTab }),
  );
  const leads = useMemo(() => data?.items ?? [], [data?.items]);
  const visibleCount = data?.visibleCount ?? leads.length;
  const [selected, setSelected] = useState<SelectedEnquiry | null>(null);
  const [openedHighlightId, setOpenedHighlightId] = useState<string | null>(null);
  const [actioningLeadId, setActioningLeadId] = useState<string | null>(null);
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const lookups = useMemo<EnquiryListResponse["lookups"]>(
    () =>
      data?.lookups ?? {
        customers: [],
        services: [],
        jobTypes: [],
        engineers: [],
        users: [],
      },
    [data?.lookups],
  );

  useEffect(() => {
    if (!highlightedLeadId || openedHighlightId === highlightedLeadId) {
      return;
    }

    const highlightedLead = leads.find((lead) => lead.id === highlightedLeadId);
    if (!highlightedLead) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setSelected({ kind: "lead", lead: highlightedLead });
      setOpenedHighlightId(highlightedLeadId);
    });
    return () => {
      cancelled = true;
    };
  }, [highlightedLeadId, leads, openedHighlightId]);

  async function runLeadRowAction(lead: LeadWithRelations, payload: Record<string, unknown>) {
    setActioningLeadId(lead.id);
    setRowActionError(null);
    try {
      await postJson(`/api/crm/leads/${lead.id}/actions`, payload);
      void refresh();
    } catch (actionError) {
      setRowActionError(actionError instanceof Error ? actionError.message : "Could not update enquiry.");
    } finally {
      setActioningLeadId(null);
    }
  }

  return (
    <>
      <SectionCard
        title="Enquiries"
        demoAnchor="lead-pipeline"
        action={
          showCreatePanel ? (
            <Link href={closeCreateHref} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Close form
            </Link>
          ) : (
            <Link href={createHref} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              New Enquiry
            </Link>
          )
        }
      >
        <EnquiryTabs active={activeTab} counts={data?.counts ?? null} />
        {rowActionError ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{rowActionError}</p> : null}
        {!data ? (
          <PanelState error={error} loadingLabel={loading ? "Loading enquiries..." : "No enquiries loaded."} />
        ) : visibleCount === 0 ? (
          <EmptyState message={enquiryEmptyMessage(activeTab)} />
        ) : (
          <div data-crm-screen-ready="true" className="space-y-3">
            {leads.map((lead) => {
              const badge = intakeBadge(lead);
              const summary = getEnquiryWorkItemSummary(lead);
              const callHref = telHref(lead.customer?.phone);
              const highlighted = lead.id === highlightedLeadId;
              const rowActioning = actioningLeadId === lead.id;
              return (
                <WorkItemRow
                  key={lead.id}
                  highlightedMarker={highlighted}
                  title={summary.title}
                  detail={[summary.reason, summary.contactLine, summary.contextLine].filter(Boolean).join(" · ")}
                  badge={summary.dueLabel}
                  label="Enquiry"
                  priority={lead.status === "new" || summary.dueLabel.toLowerCase().includes("overdue") ? "high" : "normal"}
                  className={`rounded-lg border ${
                    highlighted ? "border-cyan-300 bg-cyan-50/70 shadow-sm" : "border-slate-200"
                  }`}
                  meta={
                    <>
                      <div className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:grid-cols-3">
                        <span>
                          <span className="font-semibold text-slate-800">Owner:</span> {summary.ownerLabel}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-800">Due:</span> {summary.dueLabel}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-800">Age:</span> {summary.receivedLabel}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {badge ? <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span> : null}
                        {lead.intake_source === "website" ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">Website intake</span>
                        ) : null}
                        {lead.customer?.id ? (
                          <Link href={`/customers/${lead.customer.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                            Open customer
                          </Link>
                        ) : null}
                      </div>
                    </>
                  }
                  status={<StatusBadge config={leadStatusConfig[lead.status]} />}
                  actions={
                    <div className="flex max-w-xl flex-wrap gap-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => setSelected({ kind: "lead", lead })}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          {summary.primaryActionLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelected({ kind: "lead", lead })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Confirm Booking
                        </button>
                        {callHref ? (
                          <a href={callHref} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Call
                          </a>
                        ) : null}
                        {!lead.assigned_to ? (
                          <button
                            type="button"
                            disabled={rowActioning}
                            onClick={() => void runLeadRowAction(lead, { action: "claim" })}
                            className="rounded-lg border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-50"
                          >
                            Claim
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={rowActioning}
                          onClick={() => void runLeadRowAction(lead, { action: "snooze", preset: "later_today" })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Snooze 2h
                        </button>
                        <button
                          type="button"
                          disabled={rowActioning}
                          onClick={() => void runLeadRowAction(lead, { action: "snooze", preset: "tomorrow" })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Tomorrow 9am
                        </button>
                        <button
                          type="button"
                          disabled={rowActioning}
                          onClick={() => void runLeadRowAction(lead, { action: "snooze", preset: "in_2_days" })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          2 days
                        </button>
                        <button
                          type="button"
                          disabled={rowActioning}
                          onClick={() => void runLeadRowAction(lead, { action: "snooze", preset: "next_week" })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Next week
                        </button>
                      </div>
                  }
                />
              );
            })}
          </div>
        )}
        {data ? <PaginationControls basePath="/leads" itemCount={visibleCount} pagination={pagination} searchParams={params} /> : null}
      </SectionCard>
      <EnquiryDrawer
        selected={selected}
        lookups={lookups}
        onClose={() => setSelected(null)}
        onChanged={() => {
          void refresh();
        }}
      />
    </>
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
  // "all" (or no tab) must not send a status, otherwise the API filters to nothing.
  const activeStatus = typeof params.status === "string" && params.status.toLowerCase() !== "all" ? params.status.toLowerCase() : null;
  const { data, error, loading } = useCrmApi<ListResponse<QuoteWithRelations>>(
    apiUrlWithParams("/api/crm/quotes", pagination, { status: activeStatus }),
  );
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
        <EmptyState
          message={
            demoActive
              ? "No demo quotes for this walkthrough."
              : activeStatus
                ? `No ${activeStatus} quotes. Choose "All" to see every quote.`
                : "No quotes yet. Create one from a job or start a blank quote."
          }
        />
      ) : (
        <div data-crm-screen-ready="true" className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {quotes.map((quote) => (
            <WorkItemRow
              key={quote.id}
              title={quote.quote_number}
              detail={`${quote.customer?.full_name ?? "Customer"} · ${quote.job?.title ?? "Job"} · v${quote.current_version_number} · Valid until ${formatDate(quote.valid_until)}`}
              badge={quote.status.replace(/_/g, " ")}
              label={quote.document_type === "estimate" ? "Estimate" : "Quote"}
              href={`/quotes/${quote.id}`}
              action={quote.status === "sent" ? "Chase" : "Open"}
              priority={quote.status === "sent" ? "medium" : "normal"}
              value={formatCurrency(quote.total)}
              status={<StatusBadge config={quoteStatusConfig[quote.status]} />}
            />
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
  const moneyQueue = buildMoneyQueue({ invoices });

  return (
    <div data-crm-screen-ready={data ? "true" : undefined} className="space-y-6">
      <SectionCard
        title="Money Queue"
        action={
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {moneyQueue.summary.totalCount} open
          </span>
        }
      >
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <MoneyStat label="First action" value={moneyQueue.summary.firstAction} />
          <MoneyStat label="Invoices" value={String(moneyQueue.summary.invoiceCount)} />
          <MoneyStat label="Quotes" value={String(moneyQueue.summary.quoteCount)} />
          <MoneyStat label="Overdue" value={String(moneyQueue.summary.overdueCount)} />
        </div>
        <MoneyQueueRows items={moneyQueue.items} />
      </SectionCard>

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
              <WorkItemRow
                key={invoice.id}
                title={invoice.invoice_number}
                detail={`${invoice.customer?.full_name ?? "Customer"} · ${invoice.job?.title ?? "Job"} · Due ${formatDate(invoice.due_date)}`}
                badge={invoice.status.replace(/_/g, " ")}
                label="Invoice"
                href={`/invoices/${invoice.id}`}
                action={invoice.status === "unpaid" || invoice.status === "overdue" ? "Chase" : "Open"}
                priority={invoice.status === "overdue" ? "high" : invoice.status === "unpaid" ? "medium" : "normal"}
                value={formatCurrency(invoice.total)}
                status={<StatusBadge config={invoiceStatusConfig[invoice.status]} />}
              />
            ))}
          </div>
        )}
        {data ? <PaginationControls basePath="/invoices" itemCount={invoices.length} pagination={pagination} searchParams={params} /> : null}
      </SectionCard>
    </div>
  );
}

function MoneyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MoneyQueueRows({ items }: { items: MoneyQueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
        No invoices or quote money need chasing right now.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {items.map((item) => (
        <WorkItemRow
          key={item.id}
          title={item.title}
          detail={item.detail}
          badge={item.dueLabel}
          label={item.kind === "invoice" ? "Invoice" : "Quote"}
          href={item.href}
          action={item.action}
          priority={item.priority}
          value={item.amount}
        />
      ))}
    </div>
  );
}
