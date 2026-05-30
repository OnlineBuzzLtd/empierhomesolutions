"use client";

import { useState, useTransition } from "react";
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

export function BookingRecoveryPanel({ cases }: { cases: BookingRecoveryCase[] }) {
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
        {items.map((item) => (
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
              <div className="mt-4 grid gap-2 md:grid-cols-2">
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
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
