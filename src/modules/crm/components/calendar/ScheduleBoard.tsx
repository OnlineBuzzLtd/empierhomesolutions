"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/modules/crm/lib/format";
import {
  platformScheduleSnapshotSchema,
  type PlatformScheduleSnapshot,
} from "@/modules/crm/lib/platform-calendar";

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function bookingSummary(metadata: Record<string, unknown>) {
  const identity =
    metadata.identity && typeof metadata.identity === "object" && !Array.isArray(metadata.identity)
      ? (metadata.identity as Record<string, unknown>)
      : null;
  const customerName = identity && typeof identity.fullName === "string" ? identity.fullName : null;
  const serviceKey = typeof metadata.serviceKey === "string" ? metadata.serviceKey : null;
  return serviceKey && customerName ? `${serviceKey} — ${customerName}` : serviceKey ?? customerName ?? "Booking";
}

async function loadSnapshot(platformTenantId: string, days: number) {
  const from = startOfToday();
  const to = addDays(from, days);
  const url = new URL(`/api/platform/proxy/v1/internal/tenants/${platformTenantId}/calendar/schedule-snapshot`, "http://localhost");
  url.searchParams.set("from", from.toISOString());
  url.searchParams.set("to", to.toISOString());

  const response = await fetch(`${url.pathname}${url.search}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with ${response.status}.`;
    throw new Error(message);
  }
  try {
    return platformScheduleSnapshotSchema.parse(payload);
  } catch {
    throw new Error("Platform schedule snapshot format is invalid.");
  }
}

export function ScheduleBoard({
  platformTenantId,
}: {
  platformTenantId: string;
}) {
  const [days, setDays] = useState(7);
  const [snapshot, setSnapshot] = useState<PlatformScheduleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const next = await loadSnapshot(platformTenantId, days);
        if (!cancelled) {
          setSnapshot(next);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load schedule.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [days, platformTenantId]);

  const resources = snapshot?.resources ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dispatch Board</h2>
            <p className="mt-1 text-sm text-slate-500">
              Read-only booking board from the CustomerJourneys source of truth. Agent scheduling should follow
              this platform calendar, not mirrored CRM appointments.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 3, 7].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  days === value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {value === 1 ? "Day" : `${value} days`}
              </button>
            ))}
          </div>
        </div>
        {loading ? <p className="mt-4 text-sm text-slate-500">Loading schedule…</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      </div>

      {resources.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No platform booking resources are provisioned for this tenant yet.
        </div>
      ) : null}

      <div className="space-y-6">
        {resources.map((resource) => {
          const bookings = (snapshot?.bookings ?? [])
            .filter((booking) => booking.resourceId === resource.id)
            .sort((left, right) => left.startTime.localeCompare(right.startTime));
          const timeOff = (snapshot?.timeOff ?? []).filter(
            (row) => row.resourceId === null || row.resourceId === resource.id,
          );
          const holidays = (snapshot?.holidays ?? []).filter(
            (row) => row.resourceId === null || row.resourceId === resource.id,
          );

          return (
            <section key={resource.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{resource.displayName}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Provider: {resource.providerType} · Window {snapshot?.from ? formatDateTime(snapshot.from) : "—"}
                    {" "}to {snapshot?.to ? formatDateTime(snapshot.to) : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {bookings.length} bookings
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {timeOff.length} time off
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {holidays.length} holidays
                  </span>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Bookings</h3>
                  <div className="mt-3 space-y-2">
                    {bookings.length === 0 ? <p className="text-sm text-slate-500">No bookings in this window.</p> : null}
                    {bookings.map((booking) => (
                      <div key={booking.id} className="rounded-lg border border-slate-200 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{bookingSummary(booking.metadata)}</p>
                            <p className="text-xs text-slate-500">
                              {formatDateTime(booking.startTime)} → {formatDateTime(booking.endTime)}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-700">
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Time Off</h3>
                    <div className="mt-3 space-y-2">
                      {timeOff.length === 0 ? <p className="text-sm text-slate-500">None in this window.</p> : null}
                      {timeOff.map((row) => (
                        <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2">
                          <p className="text-sm font-medium text-slate-900">
                            {row.resourceId ? resource.displayName : "All resources"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(row.startAt)} → {formatDateTime(row.endAt)}
                          </p>
                          {row.reason ? <p className="text-xs text-slate-500">{row.reason}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Holidays</h3>
                    <div className="mt-3 space-y-2">
                      {holidays.length === 0 ? <p className="text-sm text-slate-500">None in this window.</p> : null}
                      {holidays.map((row) => (
                        <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2">
                          <p className="text-sm font-medium text-slate-900">{row.label}</p>
                          <p className="text-xs text-slate-500">
                            {row.observedOn} · {row.resourceId ? resource.displayName : "All resources"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
