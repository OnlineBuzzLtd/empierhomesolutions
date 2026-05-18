// Pure date / layout helpers for the calendar week-grid timeline view.
//
// All public functions are pure (no I/O, no DOM, no `Math.random`) so the
// WeekTimeline React component can stay thin and the math stays unit-
// testable. Timezone handling uses Intl.DateTimeFormat with timeZone:
// "Europe/London" so BST/GMT transitions work without a date library.
//
// Conventions:
//   - Week starts on Monday (UK convention).
//   - `dayIndex` is 0..6 where 0 = Monday, 6 = Sunday.
//   - `startMins` / `endMins` are minutes-from-local-midnight in the
//     tenant's display timezone.

export const DEFAULT_TIMEZONE = "Europe/London";

export type CalendarDay = {
  /** Midnight of this day in UTC (for stable keying / nav links). */
  utcMidnightIso: string;
  /** YYYY-MM-DD in the display timezone (used as the route param). */
  dateLabel: string;
  /** 0=Mon..6=Sun */
  dayIndex: number;
  /** True when this day is today in the display timezone. */
  isToday: boolean;
};

export type WeekRange = {
  /** Anchor date — Monday of the visible week, midnight UTC. */
  startIso: string;
  /** Sunday end-of-day UTC (start of next Monday). */
  endIso: string;
  days: CalendarDay[];
};

type LocalParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 1=Mon..7=Sun (ISO numbering)
};

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function getLocalParts(date: Date, timeZone: string): LocalParts {
  // Intl produces local-time fields that correctly account for DST.
  // Parsing then reconstructing into pure-number fields keeps the math
  // downstream from having to deal with timezone offsets at all.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // Intl's 24-hour format quirk: midnight is "24" in some locales.
  const rawHour = pick("hour");
  const hour = rawHour === "24" ? 0 : Number(rawHour);
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    hour,
    minute: Number(pick("minute")),
    weekday: WEEKDAY_TO_ISO[pick("weekday")] ?? 1,
  };
}

/**
 * Returns the Monday-anchored week containing the reference date,
 * interpreted in the display timezone.
 */
export function getWeekRange(
  reference: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): WeekRange {
  const refLocal = getLocalParts(reference, timeZone);
  // Days to subtract to land on Monday in the local week.
  const dayOffset = refLocal.weekday - 1;
  // Build the Monday in local time. We construct via the "noon UTC then
  // walk" trick to dodge timezone-edge fencepost bugs: noon is well
  // away from DST transitions which happen at 1am local.
  const monday = new Date(Date.UTC(refLocal.year, refLocal.month - 1, refLocal.day, 12, 0, 0));
  monday.setUTCDate(monday.getUTCDate() - dayOffset);

  const todayLocal = getLocalParts(new Date(), timeZone);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const candidate = new Date(monday);
    candidate.setUTCDate(monday.getUTCDate() + i);
    const local = getLocalParts(candidate, timeZone);
    days.push({
      utcMidnightIso: candidate.toISOString(),
      dateLabel: `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`,
      dayIndex: i,
      isToday:
        local.year === todayLocal.year &&
        local.month === todayLocal.month &&
        local.day === todayLocal.day,
    });
  }

  const start = days[0]!.utcMidnightIso;
  const lastDay = new Date(days[6]!.utcMidnightIso);
  lastDay.setUTCDate(lastDay.getUTCDate() + 1);
  return {
    startIso: start,
    endIso: lastDay.toISOString(),
    days,
  };
}

/** Parse `YYYY-MM-DD` from a query param into a Date at noon UTC. */
export function parseWeekAnchor(raw: string | null | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Add/subtract whole weeks (7 days) from a reference date. */
export function shiftWeek(reference: Date, weeks: number): Date {
  const next = new Date(reference);
  next.setUTCDate(next.getUTCDate() + weeks * 7);
  return next;
}

export type AppointmentChunk = {
  dayIndex: number;
  startMins: number;
  endMins: number;
};

/**
 * Splits an appointment (possibly spanning midnight) into per-day chunks
 * intersecting the visible week. Each chunk uses local minutes-from-
 * midnight in the display timezone. Returns [] when the appointment
 * doesn't intersect the week.
 *
 * `viewStartHour` / `viewEndHour` describe the visible vertical hours.
 * Chunks are NOT clamped here — the caller clamps when computing
 * positions, so the auto-expand-hours code can see the raw extents.
 */
export function appointmentToChunks(
  appointment: { startsAtIso: string; endsAtIso: string },
  week: WeekRange,
  timeZone: string = DEFAULT_TIMEZONE,
): AppointmentChunk[] {
  const start = new Date(appointment.startsAtIso);
  const end = new Date(appointment.endsAtIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end.getTime() <= start.getTime()) return [];

  // Everything below works in local-date arithmetic. UTC day boundaries
  // are NOT aligned with local-day boundaries in non-UTC timezones —
  // e.g. in BST, local 2026-05-19 00:00 == 2026-05-18 23:00 UTC, so
  // clipping against day.utcMidnightIso produced wrong chunks. The
  // local-day approach has no such gotcha: convert appointment to
  // local parts once, then compare each week-day's YYYY-MM-DD against
  // the appointment's local start / end date.
  const startLocal = getLocalParts(start, timeZone);
  const endLocal = getLocalParts(end, timeZone);
  const dateNum = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;
  const apptStartDate = dateNum(startLocal.year, startLocal.month, startLocal.day);
  const apptEndDate = dateNum(endLocal.year, endLocal.month, endLocal.day);

  const chunks: AppointmentChunk[] = [];
  for (const day of week.days) {
    const [yyyy, mm, dd] = day.dateLabel.split("-").map(Number) as [number, number, number];
    const dayDate = dateNum(yyyy, mm, dd);
    if (dayDate < apptStartDate || dayDate > apptEndDate) continue;

    const startMins =
      dayDate === apptStartDate ? startLocal.hour * 60 + startLocal.minute : 0;
    let endMins: number;
    if (dayDate === apptEndDate) {
      // An appointment ending exactly at local midnight would produce
      // a zero-height chunk on the end day — skip it. The previous day
      // already got a chunk ending at 24:00.
      if (endLocal.hour === 0 && endLocal.minute === 0) continue;
      endMins = endLocal.hour * 60 + endLocal.minute;
    } else {
      endMins = 24 * 60; // continues past this day
    }
    if (endMins <= startMins) continue;
    chunks.push({ dayIndex: day.dayIndex, startMins, endMins });
  }
  return chunks;
}

/**
 * Greedy interval-graph column assignment. Items overlapping in time
 * within the same day get distinct column indices; non-overlapping items
 * reuse columns. Returns each item with `colIndex` (0..colCount-1) and
 * `colCount` (the max number of concurrent items in this day, used by
 * the renderer to compute per-block width as 1/colCount).
 */
export function assignOverlapColumns<T extends { startMins: number; endMins: number }>(
  items: ReadonlyArray<T>,
): Array<T & { colIndex: number; colCount: number }> {
  if (items.length === 0) return [];
  const sorted = [...items].sort(
    (a, b) => a.startMins - b.startMins || a.endMins - b.endMins,
  );
  // For each placed item, track the column it occupies and when it ends.
  const placed: Array<T & { colIndex: number }> = [];
  // Per-column "next free at" minute.
  const columnFreeAt: number[] = [];

  for (const item of sorted) {
    // Reuse the lowest-index column whose previous item has ended.
    let colIndex = columnFreeAt.findIndex((freeAt) => freeAt <= item.startMins);
    if (colIndex === -1) {
      colIndex = columnFreeAt.length;
      columnFreeAt.push(item.endMins);
    } else {
      columnFreeAt[colIndex] = item.endMins;
    }
    placed.push({ ...item, colIndex });
  }

  // Group into "clusters" of items that share at least one moment of
  // concurrency, so colCount is per-cluster (not per-day). A cluster
  // ends as soon as we encounter a gap where ALL placed items have
  // ended. Without this, an isolated 9am block and an isolated 3pm
  // block in the same day would both inherit colCount=1 separately
  // even though they don't overlap each other.
  type WithCount = T & { colIndex: number; colCount: number };
  const result: WithCount[] = [];
  let clusterMaxCol = 0;
  let clusterEnd = -Infinity;
  let clusterStartIndex = 0;

  for (let i = 0; i < placed.length; i++) {
    const item = placed[i]!;
    if (item.startMins >= clusterEnd) {
      // Finish previous cluster.
      for (let j = clusterStartIndex; j < i; j++) {
        result.push({ ...placed[j]!, colCount: clusterMaxCol + 1 });
      }
      clusterStartIndex = i;
      clusterMaxCol = item.colIndex;
      clusterEnd = item.endMins;
    } else {
      clusterMaxCol = Math.max(clusterMaxCol, item.colIndex);
      clusterEnd = Math.max(clusterEnd, item.endMins);
    }
  }
  for (let j = clusterStartIndex; j < placed.length; j++) {
    result.push({ ...placed[j]!, colCount: clusterMaxCol + 1 });
  }

  return result;
}

/**
 * Computes top/height percentages for a block inside a day column
 * whose vertical extent is [viewStartMins, viewEndMins]. Values outside
 * the range are clamped — callers can keep the chunk even if it bleeds
 * past the view and the rendering will pin to the edges.
 */
export function computeBlockPosition(
  startMins: number,
  endMins: number,
  viewStartMins: number,
  viewEndMins: number,
): { topPct: number; heightPct: number } {
  const totalMins = viewEndMins - viewStartMins;
  if (totalMins <= 0) return { topPct: 0, heightPct: 0 };
  const clampedStart = Math.max(startMins, viewStartMins);
  const clampedEnd = Math.min(endMins, viewEndMins);
  if (clampedEnd <= clampedStart) return { topPct: 0, heightPct: 0 };
  const topPct = ((clampedStart - viewStartMins) / totalMins) * 100;
  const heightPct = ((clampedEnd - clampedStart) / totalMins) * 100;
  return { topPct, heightPct };
}

/** Format an hour 0..23 as "12 am" / "9 am" / "12 pm" / "5 pm". */
export function formatHourLabel(hour: number): string {
  const normalised = ((hour % 24) + 24) % 24;
  if (normalised === 0) return "12 am";
  if (normalised === 12) return "12 pm";
  if (normalised < 12) return `${normalised} am`;
  return `${normalised - 12} pm`;
}

/**
 * Given a list of chunks, returns the [startHour, endHour] range to
 * render so every block is visible. Falls back to the supplied default
 * range if no chunks are out-of-range.
 */
export function expandViewHours(
  chunks: ReadonlyArray<{ startMins: number; endMins: number }>,
  defaultStartHour: number,
  defaultEndHour: number,
): { startHour: number; endHour: number } {
  let startHour = defaultStartHour;
  let endHour = defaultEndHour;
  for (const c of chunks) {
    const startH = Math.floor(c.startMins / 60);
    const endH = Math.ceil(c.endMins / 60);
    if (startH < startHour) startHour = startH;
    if (endH > endHour) endHour = endH;
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}
