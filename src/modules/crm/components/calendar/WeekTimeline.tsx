"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CalendarItem } from "@/modules/crm/types";
import {
  DEFAULT_TIMEZONE,
  appointmentToChunks,
  assignOverlapColumns,
  computeBlockPosition,
  expandViewHours,
  formatHourLabel,
  getWeekRange,
} from "@/modules/crm/lib/calendar-layout";

// Week-grid timeline view for /calendar. Renders 7 day columns ×
// configurable hour rows with appointments as absolutely-positioned
// blocks. Pure layout maths live in lib/calendar-layout.ts (unit-
// tested). This component is the presentation glue + the "now" line
// state.
//
// Mobile fallback: at < lg the grid is overflow-x-scroll rather than
// re-laying out. Operators on phones can pinch-zoom; the existing
// engineer dashboard already has its own dense mobile layout for
// field use.

type WeekTimelineProps = {
  appointments: ReadonlyArray<CalendarItem>;
  weekReferenceIso: string;
  tenantTimezone?: string;
  defaultStartHour?: number;
  defaultEndHour?: number;
};

const TYPE_COLOURS: Record<string, { bg: string; border: string; text: string }> = {
  booking: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-900" },
  call: { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-900" },
  survey: { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-900" },
  follow_up: { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-900" },
  meeting: { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-900" },
  reminder: { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-800" },
};

const FALLBACK_COLOUR = {
  bg: "bg-slate-100",
  border: "border-slate-300",
  text: "text-slate-800",
};

// Pixels per hour. 60px keeps a 13-hour day (7am-8pm) ~780px tall —
// fits a 1280×800 laptop without scrolling, dense enough to read 30-
// minute blocks. Tune via the constant if needed.
const HOUR_HEIGHT_PX = 60;

export function WeekTimeline({
  appointments,
  weekReferenceIso,
  tenantTimezone = DEFAULT_TIMEZONE,
  defaultStartHour = 7,
  defaultEndHour = 20,
}: WeekTimelineProps) {
  const reference = useMemo(() => new Date(weekReferenceIso), [weekReferenceIso]);
  const week = useMemo(() => getWeekRange(reference, tenantTimezone), [reference, tenantTimezone]);

  // All chunks across the week, used both to auto-expand the visible
  // hours and to render per-day. Computed once per render — pure.
  const chunksByDay = useMemo(() => {
    const buckets: Array<Array<{ appt: CalendarItem; startMins: number; endMins: number }>> =
      Array.from({ length: 7 }, () => []);
    for (const appt of appointments) {
      const chunks = appointmentToChunks(
        { startsAtIso: appt.starts_at, endsAtIso: appt.ends_at },
        week,
        tenantTimezone,
      );
      for (const c of chunks) {
        buckets[c.dayIndex]!.push({ appt, startMins: c.startMins, endMins: c.endMins });
      }
    }
    return buckets;
  }, [appointments, week, tenantTimezone]);

  const { startHour, endHour } = useMemo(
    () =>
      expandViewHours(
        chunksByDay.flat(),
        defaultStartHour,
        defaultEndHour,
      ),
    [chunksByDay, defaultStartHour, defaultEndHour],
  );

  const hourCount = Math.max(1, endHour - startHour);
  const viewStartMins = startHour * 60;
  const viewEndMins = endHour * 60;
  const bodyHeightPx = hourCount * HOUR_HEIGHT_PX;

  // Per-day placed blocks (with colIndex / colCount).
  const placedByDay = useMemo(
    () =>
      chunksByDay.map((dayChunks) =>
        assignOverlapColumns(
          dayChunks.map((c) => ({
            appt: c.appt,
            startMins: c.startMins,
            endMins: c.endMins,
          })),
        ),
      ),
    [chunksByDay],
  );

  // "Now" line — only ticks while a today column is in the visible
  // week. Updates every 60s; cheap because it just re-renders one
  // line element.
  const [nowMins, setNowMins] = useState<number | null>(null);
  useEffect(() => {
    function update() {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: tenantTimezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = fmt.formatToParts(now);
      const h = parts.find((p) => p.type === "hour")?.value ?? "0";
      const m = parts.find((p) => p.type === "minute")?.value ?? "0";
      setNowMins((Number(h) === 24 ? 0 : Number(h)) * 60 + Number(m));
    }
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [tenantTimezone]);

  const todayIndex = week.days.findIndex((d) => d.isToday);
  const nowTopPct =
    nowMins !== null && todayIndex >= 0
      ? computeBlockPosition(nowMins, nowMins + 1, viewStartMins, viewEndMins).topPct
      : null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div className="min-w-[900px]">
        {/* Header row: spacer + 7 day labels */}
        <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}>
          <div className="border-r border-slate-200" />
          {week.days.map((day) => {
            const date = new Date(day.utcMidnightIso);
            const fmt = new Intl.DateTimeFormat("en-GB", {
              timeZone: tenantTimezone,
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const parts = fmt.formatToParts(date);
            const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
            const dayNum = parts.find((p) => p.type === "day")?.value ?? "";
            const month = parts.find((p) => p.type === "month")?.value ?? "";
            return (
              <div
                key={day.dateLabel}
                className={`flex flex-col items-center gap-0.5 border-r border-slate-200 px-2 py-2 text-xs last:border-r-0 ${
                  day.isToday ? "bg-blue-50" : ""
                }`}
              >
                <span className="font-semibold uppercase tracking-wide text-slate-500">{weekday}</span>
                <span className={`text-base font-bold ${day.isToday ? "text-blue-700" : "text-slate-900"}`}>
                  {dayNum} {month}
                </span>
              </div>
            );
          })}
        </div>

        {/* Body: hour labels + day columns. Grid layout so the columns
            align with the header. Each day column is `relative` and
            the blocks inside are absolute-positioned with top/height
            as percentages of the column's height. */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))",
            height: `${bodyHeightPx}px`,
          }}
        >
          {/* Hour-label column */}
          <div className="relative border-r border-slate-200">
            {Array.from({ length: hourCount }).map((_, idx) => {
              const hour = startHour + idx;
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 -translate-y-1/2 pr-1.5 text-right text-[10px] font-medium text-slate-400"
                  style={{ top: `${(idx / hourCount) * 100}%` }}
                >
                  {idx === 0 ? "" : formatHourLabel(hour)}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {week.days.map((day, dayIdx) => {
            const placed = placedByDay[dayIdx] ?? [];
            const isToday = day.isToday;
            return (
              <div
                key={day.dateLabel}
                className={`relative border-r border-slate-200 last:border-r-0 ${isToday ? "bg-blue-50/40" : ""}`}
              >
                {/* Hour gridlines */}
                {Array.from({ length: hourCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className="absolute left-0 right-0 border-t border-slate-100"
                    style={{ top: `${(idx / hourCount) * 100}%` }}
                  />
                ))}
                {/* Half-hour gridlines, fainter */}
                {Array.from({ length: hourCount }).map((_, idx) => (
                  <div
                    key={`half-${idx}`}
                    className="absolute left-0 right-0 border-t border-slate-50"
                    style={{ top: `${((idx + 0.5) / hourCount) * 100}%` }}
                  />
                ))}

                {/* Now line on today's column */}
                {isToday && nowTopPct !== null ? (
                  <div
                    className="absolute left-0 right-0 z-20"
                    style={{ top: `${nowTopPct}%` }}
                  >
                    <div className="relative h-px bg-rose-500">
                      <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                    </div>
                  </div>
                ) : null}

                {/* Blocks */}
                {placed.map(({ appt, startMins, endMins, colIndex, colCount }) => {
                  const { topPct, heightPct } = computeBlockPosition(
                    startMins,
                    endMins,
                    viewStartMins,
                    viewEndMins,
                  );
                  if (heightPct === 0) return null;
                  const colour = TYPE_COLOURS[appt.type] ?? FALLBACK_COLOUR;
                  const cancelled = appt.status === "cancelled";
                  const widthPct = 100 / colCount;
                  const leftPct = colIndex * widthPct;
                  const Tag = appt.entity_link ? Link : "div";
                  return (
                    <Tag
                      key={`${appt.id}-${startMins}`}
                      href={appt.entity_link ?? "#"}
                      className={`absolute z-10 overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight shadow-sm transition hover:z-30 hover:shadow-md ${colour.bg} ${colour.border} ${colour.text} ${
                        cancelled ? "opacity-50 line-through" : ""
                      }`}
                      style={{
                        top: `${topPct}%`,
                        height: `calc(${heightPct}% - 2px)`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                      title={`${appt.title} · ${appt.customer?.full_name ?? "No customer"}${
                        appt.owner?.full_name ? ` · ${appt.owner.full_name}` : ""
                      }`}
                    >
                      <div className="truncate font-semibold">{appt.title}</div>
                      {appt.customer?.full_name ? (
                        <div className="truncate text-[10px] opacity-80">{appt.customer.full_name}</div>
                      ) : null}
                    </Tag>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
