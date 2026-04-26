"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/modules/crm/lib/format";
import {
  platformAvailabilitySnapshotSchema,
  type PlatformAvailabilitySnapshot,
} from "@/modules/crm/lib/platform-calendar";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type WorkingWindow = {
  start: string;
  end: string;
};

function minutesToHHMM(minutes: number) {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function hhmmToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
    return null;
  }
  return Math.min(hours * 60 + minutes, 1440);
}

function buildEmptyGrid() {
  return {
    0: [] as WorkingWindow[],
    1: [] as WorkingWindow[],
    2: [] as WorkingWindow[],
    3: [] as WorkingWindow[],
    4: [] as WorkingWindow[],
    5: [] as WorkingWindow[],
    6: [] as WorkingWindow[],
  };
}

function deriveGrid(snapshot: PlatformAvailabilitySnapshot | null, resourceId: string | null) {
  const next = buildEmptyGrid();
  if (!snapshot || !resourceId) {
    return next;
  }
  for (const row of snapshot.workingHours) {
    if (row.resourceId !== resourceId) {
      continue;
    }
    next[row.weekday as keyof typeof next] = [
      ...next[row.weekday as keyof typeof next],
      {
        start: minutesToHHMM(row.startMinutes),
        end: minutesToHHMM(row.endMinutes),
      },
    ];
  }
  return next;
}

async function readJson<T>(response: Response, parser: { parse: (input: unknown) => T }) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with ${response.status}.`;
    throw new Error(message);
  }
  try {
    return parser.parse(payload);
  } catch {
    throw new Error("Platform availability snapshot format is invalid.");
  }
}

export function AvailabilityManager({
  platformTenantId,
}: {
  platformTenantId: string;
}) {
  const [snapshot, setSnapshot] = useState<PlatformAvailabilitySnapshot | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [grid, setGrid] = useState(buildEmptyGrid);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeOffForm, setTimeOffForm] = useState({
    startAt: "",
    endAt: "",
    reason: "",
    allDay: false,
    appliesToAll: false,
  });
  const [holidayForm, setHolidayForm] = useState({
    observedOn: "",
    label: "",
    appliesToAll: false,
  });

  async function fetchSnapshot() {
    const response = await fetch(
      `/api/platform/proxy/v1/internal/tenants/${platformTenantId}/calendar/availability-snapshot`,
      {
        cache: "no-store",
      },
    );
    return readJson(response, platformAvailabilitySnapshotSchema);
  }

  async function loadSnapshot(preserveSelection = true) {
    setLoading(true);
    try {
      const parsed = await fetchSnapshot();
      setSnapshot(parsed);
      setSelectedResourceId((current) => {
        if (preserveSelection && current && parsed.resources.some((resource) => resource.id === current)) {
          return current;
        }
        return parsed.resources[0]?.id ?? null;
      });
      setError(null);
      return parsed;
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Failed to load availability.";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshot(false).catch(() => undefined);
  }, [platformTenantId]);

  useEffect(() => {
    setGrid(deriveGrid(snapshot, selectedResourceId));
  }, [snapshot, selectedResourceId]);

  async function mutate(path: string, init: RequestInit, successMessage: string) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(path, init);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : `Request failed with ${response.status}.`;
        throw new Error(message);
      }
      await loadSnapshot();
      setSuccess(successMessage);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedResource = snapshot?.resources.find((resource) => resource.id === selectedResourceId) ?? null;
  const visibleTimeOff = (snapshot?.timeOff ?? []).filter(
    (row) => row.resourceId === null || row.resourceId === selectedResourceId,
  );
  const visibleHolidays = (snapshot?.holidays ?? []).filter(
    (row) => row.resourceId === null || row.resourceId === selectedResourceId,
  );
  const visibleIcsTokens = (snapshot?.icsTokens ?? []).filter((row) => row.resourceId === selectedResourceId);

  async function saveWorkingHours() {
    if (!selectedResource) {
      setError("Choose a resource first.");
      return;
    }
    try {
      const rows = weekdayLabels.flatMap((_, weekday) =>
        (grid[weekday as keyof typeof grid] ?? []).map((row) => {
          const startMinutes = hhmmToMinutes(row.start);
          const endMinutes = hhmmToMinutes(row.end);
          if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
            throw new Error(`Invalid window on ${weekdayLabels[weekday]}.`);
          }
          return {
            weekday,
            startMinutes,
            endMinutes,
          };
        }),
      );
      await mutate(
        `/api/platform/proxy/v1/internal/tenants/${platformTenantId}/resources/${selectedResource.id}/working-hours`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rows }),
        },
        "Working hours saved.",
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save working hours.");
    }
  }

  async function addTimeOff() {
    if (!selectedResource) {
      setError("Choose a resource first.");
      return;
    }
    if (!timeOffForm.startAt || !timeOffForm.endAt) {
      setError("Time off requires both a start and end time.");
      return;
    }
    await mutate(
      `/api/platform/proxy/v1/internal/tenants/${platformTenantId}/time-off`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resourceId: timeOffForm.appliesToAll ? null : selectedResource.id,
          startAt: new Date(timeOffForm.startAt).toISOString(),
          endAt: new Date(timeOffForm.endAt).toISOString(),
          allDay: timeOffForm.allDay,
          reason: timeOffForm.reason || null,
        }),
      },
      "Time off saved.",
    );
    setTimeOffForm({
      startAt: "",
      endAt: "",
      reason: "",
      allDay: false,
      appliesToAll: false,
    });
  }

  async function addHoliday() {
    if (!selectedResource) {
      setError("Choose a resource first.");
      return;
    }
    if (!holidayForm.observedOn || !holidayForm.label.trim()) {
      setError("Holiday requires a date and label.");
      return;
    }
    await mutate(
      `/api/platform/proxy/v1/internal/tenants/${platformTenantId}/holidays`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resourceId: holidayForm.appliesToAll ? null : selectedResource.id,
          observedOn: holidayForm.observedOn,
          label: holidayForm.label.trim(),
        }),
      },
      "Holiday saved.",
    );
    setHolidayForm({
      observedOn: "",
      label: "",
      appliesToAll: false,
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Native Calendar Control Plane</h2>
            <p className="mt-1 text-sm text-slate-500">
              CustomerJourneys remains the source of truth for working hours, time off, holidays, and ICS
              subscriptions. Changes here write through to the platform-native calendar.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedResourceId ?? ""}
              onChange={(event) => setSelectedResourceId(event.target.value || null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              {(snapshot?.resources ?? []).map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.displayName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadSnapshot()}
              disabled={loading || submitting}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
        </div>
        {loading ? <p className="mt-4 text-sm text-slate-500">Loading native calendar state…</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}
      </div>

      {!selectedResource ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No platform booking resources are provisioned for this tenant yet.
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Working Hours</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Weekly schedule for <strong>{selectedResource.displayName}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGrid(buildEmptyGrid());
                  setSuccess(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear draft
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {weekdayLabels.map((label, index) => {
                const rows = grid[index as keyof typeof grid] ?? [];
                return (
                  <div key={label} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                      <button
                        type="button"
                        onClick={() =>
                          setGrid((current) => ({
                            ...current,
                            [index]: [...(current[index as keyof typeof current] ?? []), { start: "08:00", end: "17:00" }],
                          }))
                        }
                        className="text-xs font-medium text-blue-700 hover:text-blue-800"
                      >
                        Add window
                      </button>
                    </div>
                    <div className="space-y-2">
                      {rows.length === 0 ? <p className="text-xs text-slate-500">Closed</p> : null}
                      {rows.map((row, rowIndex) => (
                        <div key={`${label}-${rowIndex}`} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={row.start}
                            onChange={(event) =>
                              setGrid((current) => ({
                                ...current,
                                [index]: (current[index as keyof typeof current] ?? []).map((entry, entryIndex) =>
                                  entryIndex === rowIndex ? { ...entry, start: event.target.value } : entry,
                                ),
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          />
                          <span className="text-slate-400">→</span>
                          <input
                            type="time"
                            value={row.end}
                            onChange={(event) =>
                              setGrid((current) => ({
                                ...current,
                                [index]: (current[index as keyof typeof current] ?? []).map((entry, entryIndex) =>
                                  entryIndex === rowIndex ? { ...entry, end: event.target.value } : entry,
                                ),
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setGrid((current) => ({
                                ...current,
                                [index]: (current[index as keyof typeof current] ?? []).filter(
                                  (_, entryIndex) => entryIndex !== rowIndex,
                                ),
                              }))
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void saveWorkingHours()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? "Saving..." : "Save Working Hours"}
              </button>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Time Off</h2>
              <p className="mt-1 text-sm text-slate-500">
                Block one-off unavailability for this engineer or the whole tenant.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span>Start</span>
                  <input
                    type="datetime-local"
                    value={timeOffForm.startAt}
                    onChange={(event) => setTimeOffForm((current) => ({ ...current, startAt: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span>End</span>
                  <input
                    type="datetime-local"
                    value={timeOffForm.endAt}
                    onChange={(event) => setTimeOffForm((current) => ({ ...current, endAt: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                  <span>Reason</span>
                  <input
                    type="text"
                    value={timeOffForm.reason}
                    onChange={(event) => setTimeOffForm((current) => ({ ...current, reason: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Holiday, training, sick leave…"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={timeOffForm.allDay}
                    onChange={(event) => setTimeOffForm((current) => ({ ...current, allDay: event.target.checked }))}
                  />
                  All day
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={timeOffForm.appliesToAll}
                    onChange={(event) =>
                      setTimeOffForm((current) => ({ ...current, appliesToAll: event.target.checked }))
                    }
                  />
                  Apply to all resources
                </label>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void addTimeOff()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Add Time Off
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {visibleTimeOff.length === 0 ? <p className="text-sm text-slate-500">No time off configured.</p> : null}
                {visibleTimeOff.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {row.resourceId ? selectedResource.displayName : "All resources"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(row.startAt)} → {formatDateTime(row.endAt)}
                      </p>
                      {row.reason ? <p className="text-xs text-slate-500">{row.reason}</p> : null}
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        void mutate(
                          `/api/platform/proxy/v1/internal/tenants/${platformTenantId}/time-off/${row.id}`,
                          { method: "DELETE" },
                          "Time off removed.",
                        )
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Holidays</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add tenant-wide or engineer-specific holiday closures.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span>Date</span>
                  <input
                    type="date"
                    value={holidayForm.observedOn}
                    onChange={(event) =>
                      setHolidayForm((current) => ({ ...current, observedOn: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span>Label</span>
                  <input
                    type="text"
                    value={holidayForm.label}
                    onChange={(event) => setHolidayForm((current) => ({ ...current, label: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Bank holiday"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={holidayForm.appliesToAll}
                    onChange={(event) =>
                      setHolidayForm((current) => ({ ...current, appliesToAll: event.target.checked }))
                    }
                  />
                  Apply to all resources
                </label>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void addHoliday()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Add Holiday
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {visibleHolidays.length === 0 ? <p className="text-sm text-slate-500">No holidays configured.</p> : null}
                {visibleHolidays.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{row.label}</p>
                      <p className="text-xs text-slate-500">
                        {row.observedOn} · {row.resourceId ? selectedResource.displayName : "All resources"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        void mutate(
                          `/api/platform/proxy/v1/internal/tenants/${platformTenantId}/holidays/${row.id}`,
                          { method: "DELETE" },
                          "Holiday removed.",
                        )
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">ICS Subscriptions</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Issue or revoke feed URLs for <strong>{selectedResource.displayName}</strong>.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  void mutate(
                    `/api/platform/proxy/v1/internal/tenants/${platformTenantId}/resources/${selectedResource.id}/ics-tokens`,
                    { method: "POST" },
                    "ICS token issued.",
                  )
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Issue Token
              </button>
            </div>
            <div className="space-y-2">
              {visibleIcsTokens.length === 0 ? <p className="text-sm text-slate-500">No ICS tokens issued yet.</p> : null}
              {visibleIcsTokens.map((token) => (
                <div key={token.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-xs text-slate-700">{token.subscriptionUrl}</p>
                    <p className="mt-1 text-xs text-slate-500">Issued {formatDateTime(token.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void mutate(
                        `/api/platform/proxy/v1/internal/tenants/${platformTenantId}/ics-tokens/${token.id}`,
                        { method: "DELETE" },
                        "ICS token revoked.",
                      )
                    }
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
