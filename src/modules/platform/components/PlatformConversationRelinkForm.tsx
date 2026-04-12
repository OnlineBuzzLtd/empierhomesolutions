"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoReadonlyNotice } from "@/modules/crm/components/demo/DemoReadonlyNotice";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

type CustomerSearchResult = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  postcode: string | null;
};

type JobSearchResult = {
  id: string;
  customer_id: string | null;
  title: string | null;
  status: string | null;
  scheduled_date: string | null;
};

export function PlatformConversationRelinkForm({
  conversationId,
  customerId,
  jobId,
}: {
  conversationId: string;
  customerId: string | null;
  jobId: string | null;
}) {
  const router = useRouter();
  const demo = useCrmDemoMode();
  const [customerValue, setCustomerValue] = useState(customerId ?? "");
  const [jobValue, setJobValue] = useState(jobId ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [jobQuery, setJobQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [jobResults, setJobResults] = useState<JobSearchResult[]>([]);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [jobSearchError, setJobSearchError] = useState<string | null>(null);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function search(type: "customer" | "job") {
    const query = type === "customer" ? customerQuery.trim() : jobQuery.trim();
    if (query.length < 2) {
      if (type === "customer") {
        setCustomerSearchError("Enter at least 2 characters to search customers.");
        setCustomerResults([]);
      } else {
        setJobSearchError("Enter at least 2 characters to search jobs.");
        setJobResults([]);
      }
      return;
    }

    if (type === "customer") {
      setIsSearchingCustomers(true);
      setCustomerSearchError(null);
    } else {
      setIsSearchingJobs(true);
      setJobSearchError(null);
    }

    const response = await fetch(`/api/platform/relink/search?type=${type}&q=${encodeURIComponent(query)}`);
    const result = await response.json().catch(() => ({ error: "Unexpected response." }));

    if (!response.ok) {
      if (type === "customer") {
        setCustomerSearchError(result.error ?? "Failed to search customers.");
        setCustomerResults([]);
        setIsSearchingCustomers(false);
      } else {
        setJobSearchError(result.error ?? "Failed to search jobs.");
        setJobResults([]);
        setIsSearchingJobs(false);
      }
      return;
    }

    if (type === "customer") {
      setCustomerResults((result.customers ?? []) as CustomerSearchResult[]);
      setCustomerSearchError(null);
      setIsSearchingCustomers(false);
      return;
    }

    setJobResults((result.jobs ?? []) as JobSearchResult[]);
    setJobSearchError(null);
    setIsSearchingJobs(false);
  }

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/platform/conversations/${conversationId}/relink`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: customerValue.trim() || null,
        job_id: jobValue.trim() || null,
      }),
    });

    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    if (!response.ok) {
      setError(result.error ?? "Failed to save relink.");
      setIsSubmitting(false);
      return;
    }

    setSuccess("Conversation link updated.");
    setIsSubmitting(false);
    router.refresh();
  }

  function reset() {
    setCustomerValue(customerId ?? "");
    setJobValue(jobId ?? "");
    setCustomerQuery("");
    setJobQuery("");
    setCustomerResults([]);
    setJobResults([]);
    setCustomerSearchError(null);
    setJobSearchError(null);
    setError(null);
    setSuccess(null);
  }

  function selectCustomer(result: CustomerSearchResult) {
    setCustomerValue(result.id);
    setJobValue("");
    setCustomerResults([]);
    setCustomerSearchError(null);
    setSuccess(null);
    setError(null);
  }

  function selectJob(result: JobSearchResult) {
    setJobValue(result.id);
    if (result.customer_id) {
      setCustomerValue(result.customer_id);
    }
    setJobResults([]);
    setJobSearchError(null);
    setSuccess(null);
    setError(null);
  }

  function describeCustomer(result: CustomerSearchResult) {
    return [result.full_name, result.phone, result.email, result.postcode].filter(Boolean).join(" | ");
  }

  function describeJob(result: JobSearchResult) {
    return [result.title, result.status, result.scheduled_date, result.customer_id].filter(Boolean).join(" | ");
  }

  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-700">
        Manual relink
      </summary>
      <div className="border-t border-slate-200 px-3 py-3">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer search</span>
              <div className="flex gap-2">
                <input
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Search by name, phone, email, postcode, or ID"
                  disabled={isSubmitting || demo.active}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => void search("customer")}
                  disabled={isSubmitting || isSearchingCustomers || demo.active}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {isSearchingCustomers ? "Searching..." : "Find"}
                </button>
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer ID</span>
              <input
                value={customerValue}
                onChange={(event) => setCustomerValue(event.target.value)}
                placeholder="Paste CRM customer UUID or pick a search result"
                disabled={isSubmitting || demo.active}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            {customerSearchError ? <p className="text-sm text-rose-700">{customerSearchError}</p> : null}
            {customerResults.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer matches
                </div>
                <div className="divide-y divide-slate-200">
                  {customerResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => selectCustomer(result)}
                      disabled={isSubmitting || demo.active}
                      className="block w-full px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed"
                    >
                      <div className="text-sm font-medium text-slate-900">{result.full_name || result.id}</div>
                      <div className="text-xs text-slate-500">{describeCustomer(result)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job search</span>
              <div className="flex gap-2">
                <input
                  value={jobQuery}
                  onChange={(event) => setJobQuery(event.target.value)}
                  placeholder="Search by title, date, status, customer ID, or job ID"
                  disabled={isSubmitting || demo.active}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => void search("job")}
                  disabled={isSubmitting || isSearchingJobs || demo.active}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {isSearchingJobs ? "Searching..." : "Find"}
                </button>
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job ID</span>
              <input
                value={jobValue}
                onChange={(event) => setJobValue(event.target.value)}
                placeholder="Paste CRM job UUID or pick a search result"
                disabled={isSubmitting || demo.active}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            {jobSearchError ? <p className="text-sm text-rose-700">{jobSearchError}</p> : null}
            {jobResults.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Job matches
                </div>
                <div className="divide-y divide-slate-200">
                  {jobResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => selectJob(result)}
                      disabled={isSubmitting || demo.active}
                      className="block w-full px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed"
                    >
                      <div className="text-sm font-medium text-slate-900">{result.title || result.id}</div>
                      <div className="text-xs text-slate-500">{describeJob(result)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Clearing the customer also clears the linked job unless you set a job explicitly. If you set a job, its customer becomes the conversation customer.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isSubmitting || demo.active}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {demo.active ? "Demo Mode Locked" : isSubmitting ? "Saving..." : "Save relink"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Reset
          </button>
          <DemoReadonlyNotice />
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </div>
      </div>
    </details>
  );
}
