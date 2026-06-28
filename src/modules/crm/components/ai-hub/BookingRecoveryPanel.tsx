"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { findBookingRecoveryCustomerCandidates, findBookingRecoveryJobCandidates } from "@/modules/crm/lib/booking-recovery-matches";
import type { Customer, JobWithRelations } from "@/modules/crm/types";
import type { BookingRecoveryCase } from "@/modules/platform/lib/booking-recovery";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Time not set";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function resolveCase(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/crm/ai-receptionist/recovery-cases/${id}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Could not resolve booking.");
  }
}

export function BookingRecoveryPanel({
  cases,
  customers = [],
  jobs = [],
}: {
  cases: BookingRecoveryCase[];
  customers?: Customer[];
  jobs?: JobWithRelations[];
}) {
  const [items, setItems] = useState(cases);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkIds, setLinkIds] = useState<Record<string, { customerId: string; jobId: string }>>({});
  const [, startTransition] = useTransition();

  if (items.length === 0) {
    return null;
  }

  function updateLinkId(id: string, field: "customerId" | "jobId", value: string) {
    setLinkIds((current) => ({
      ...current,
      [id]: {
        customerId: current[id]?.customerId ?? "",
        jobId: current[id]?.jobId ?? "",
        [field]: value,
      },
    }));
  }

  function run(id: string, body: Record<string, unknown>) {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      try {
        await resolveCase(id, body);
        setItems((current) => current.filter((item) => item.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not resolve booking.");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Needs review</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">AI bookings that need linking</h2>
          <p className="mt-1 text-sm text-slate-600">
            These bookings reached the Scheduler but need a safe customer, enquiry, and job link before field work starts.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
          {items.length} open
        </span>
      </div>
      {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const customerCandidates = findBookingRecoveryCustomerCandidates(item, customers);
          const jobCandidates = findBookingRecoveryJobCandidates(item, jobs);
          return (
          <article key={item.id} className="rounded-xl border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{item.customerName ?? item.service ?? "Unlinked booking"}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {[item.channel, item.phone, item.email, item.address, item.postcode].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-700">
                  {item.service ?? "Booking"} · {formatDateTime(item.startsAt)}
                </p>
                {item.conflictingCustomerId ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Possible customer conflict. Review the match before linking this booking.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {item.eventId ? (
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={pendingId === item.id}
                    onClick={() => run(item.id, { action: "create_new_customer_and_job" })}
                  >
                    Create new customer and job
                  </button>
                ) : null}
                {item.eventId ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    disabled={pendingId === item.id}
                    onClick={() => run(item.id, { action: "dismiss" })}
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            </div>
            {item.eventId ? (
              <>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Match using</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {[item.customerName, item.phone, item.email, item.postcode].filter(Boolean).join(" · ") ||
                      "No customer identity details were supplied by the AI booking."}
                  </p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Suggested customers</p>
                      {customerCandidates.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">No close customer matches found.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {customerCandidates.map(({ customer, reasons }) => (
                            <div key={customer.id} className="rounded-lg bg-white px-3 py-2">
                              <p className="text-sm font-semibold text-slate-900">{customer.full_name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {[customer.phone, customer.email, customer.postcode].filter(Boolean).join(" · ")}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">{reasons.join(", ")}</p>
                              <button
                                type="button"
                                className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                                disabled={pendingId === item.id}
                                onClick={() => run(item.id, { action: "link_existing_customer", customerId: customer.id })}
                              >
                                Link this customer
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Link href="/customers" className="mt-2 inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Browse customers
                      </Link>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Suggested jobs</p>
                      {jobCandidates.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">No close job matches found.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {jobCandidates.map(({ job, reasons }) => (
                            <div key={job.id} className="rounded-lg bg-white px-3 py-2">
                              <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {[job.customer?.full_name, job.scheduled_date, job.status].filter(Boolean).join(" · ")}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">{reasons.join(", ")}</p>
                              <button
                                type="button"
                                className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                                disabled={pendingId === item.id}
                                onClick={() => run(item.id, { action: "link_existing_job", jobId: job.id })}
                              >
                                Link this job
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Link href="/jobs" className="mt-2 inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Browse jobs
                      </Link>
                    </div>
                  </div>
                </div>

                <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Advanced link by ID
                  </summary>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="flex gap-2">
                      <input
                        value={linkIds[item.id]?.customerId ?? ""}
                        onChange={(event) => updateLinkId(item.id, "customerId", event.target.value)}
                        placeholder="Existing customer ID"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        disabled={pendingId === item.id || !linkIds[item.id]?.customerId}
                        onClick={() => run(item.id, { action: "link_existing_customer", customerId: linkIds[item.id]?.customerId })}
                      >
                        Link customer
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={linkIds[item.id]?.jobId ?? ""}
                        onChange={(event) => updateLinkId(item.id, "jobId", event.target.value)}
                        placeholder="Existing job ID"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        disabled={pendingId === item.id || !linkIds[item.id]?.jobId}
                        onClick={() => run(item.id, { action: "link_existing_job", jobId: linkIds[item.id]?.jobId })}
                      >
                        Link job
                      </button>
                    </div>
                  </div>
                </details>
              </>
            ) : null}
          </article>
          );
        })}
      </div>
    </section>
  );
}
