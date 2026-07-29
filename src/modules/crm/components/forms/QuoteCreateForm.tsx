"use client";

import { useEffect, useState } from "react";
import type { Customer, Job, Product, Quote } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { LineItemsEditor } from "@/modules/crm/components/forms/LineItemsEditor";

// Jobs belong to a customer, so the job dropdown must only offer the selected
// customer's jobs. Previously both selects were uncontrolled and the job list
// rendered every job for every customer, which made picking the right job
// guesswork and allowed a quote to be attached to another customer's job.
export function filterJobsForCustomer(jobs: Job[], customerId: string): Job[] {
  if (!customerId) {
    return [];
  }
  return jobs.filter((job) => job.customer_id === customerId);
}

export function QuoteCreateForm({
  customers,
  jobs,
  products = [],
  initialQuote,
  optionalExtras = [],
  paymentTermsSummary,
  templateLabel,
  endpoint = "/api/crm/quotes",
  submitLabel = "Create Quote",
  includeChangeSummary = false,
}: {
  customers: Customer[];
  jobs: Job[];
  products?: Product[];
  initialQuote?: Partial<Quote>;
  optionalExtras?: Quote["line_items"];
  paymentTermsSummary?: string | null;
  templateLabel?: string | null;
  endpoint?: string;
  submitLabel?: string;
  includeChangeSummary?: boolean;
}) {
  const [customerId, setCustomerId] = useState(initialQuote?.customer_id ?? "");
  // The server-rendered `jobs` prop is a capped page of ALL jobs, so filtering
  // it client-side would silently miss a customer's jobs once the tenant has
  // more jobs than that cap. Fetch the customer's own jobs instead, and fall
  // back to the prop list if the request fails.
  const [fetchedJobs, setFetchedJobs] = useState<Job[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setFetchedJobs(null);
      return;
    }
    const controller = new AbortController();
    setJobsLoading(true);
    fetch(`/api/crm/jobs?customerId=${encodeURIComponent(customerId)}&pageSize=200`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => {
        setFetchedJobs(Array.isArray(body?.items) ? (body.items as Job[]) : []);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name !== "AbortError") {
          setFetchedJobs(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setJobsLoading(false);
        }
      });
    return () => controller.abort();
  }, [customerId]);

  const availableJobs = fetchedJobs ?? filterJobsForCustomer(jobs, customerId);

  return (
    <ApiForm endpoint={endpoint} submitLabel={submitLabel} className="space-y-3">
      {templateLabel || paymentTermsSummary || optionalExtras.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {templateLabel ? <p className="font-semibold text-slate-900">Template: {templateLabel}</p> : null}
          {paymentTermsSummary ? <p className="mt-1">Payment terms: {paymentTermsSummary}</p> : null}
          {optionalExtras.length > 0 ? <p className="mt-1 text-slate-600">{optionalExtras.length} optional extras ready to add below.</p> : null}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <select
          name="customer_id"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select customer…</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.full_name}
            </option>
          ))}
        </select>
        <div>
          <select
            // Re-mount on customer change so a previously chosen job cannot stay
            // selected once it no longer belongs to the chosen customer.
            key={`${customerId}:${availableJobs.length}`}
            name="job_id"
            defaultValue={initialQuote?.job_id}
            required
            disabled={!customerId || jobsLoading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {!customerId
                ? "Select a customer first…"
                : jobsLoading
                  ? "Loading jobs…"
                  : availableJobs.length === 0
                    ? "No jobs for this customer"
                    : "Select job…"}
            </option>
            {availableJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
          {customerId && !jobsLoading && availableJobs.length === 0 ? (
            <p className="mt-1 text-xs text-slate-500">Create a job for this customer first, then quote against it.</p>
          ) : null}
        </div>
        <select name="document_type" defaultValue={initialQuote?.document_type ?? "quote"} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="quote">Quote</option>
          <option value="estimate">Estimate</option>
        </select>
        <input name="vat_rate" type="number" step="0.01" min="0" max="1" defaultValue={initialQuote?.vat_rate ?? 0.2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select name="status" defaultValue={initialQuote?.status ?? "draft"} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </select>
        <select name="vat_category" defaultValue={initialQuote?.vat_category ?? "standard_20"} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="standard_20">20% VAT</option>
          <option value="vat_exempt">VAT Exempt</option>
          <option value="reverse_charge">Reverse Charge</option>
        </select>
        <input name="valid_until" type="date" defaultValue={initialQuote?.valid_until ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      {includeChangeSummary ? (
        <input name="change_summary" placeholder="Revision summary" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      ) : null}
      <LineItemsEditor
        key={JSON.stringify({
          templateLabel,
          lineItems: initialQuote?.line_items ?? [],
          optionalExtras,
          products: products.map((product) => product.id),
        })}
        name="line_items"
        initialItems={initialQuote?.line_items}
        products={products}
        optionalExtras={optionalExtras}
      />
    </ApiForm>
  );
}
