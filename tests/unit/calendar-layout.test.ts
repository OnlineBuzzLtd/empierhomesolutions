import { describe, expect, it } from "vitest";
import {
  appointmentToChunks,
  assignOverlapColumns,
  computeBlockPosition,
  expandViewHours,
  formatHourLabel,
  getWeekRange,
  parseWeekAnchor,
  shiftWeek,
} from "@/modules/crm/lib/calendar-layout";

// Pure-function tests for the week-grid calendar layout. The React
// component is verified separately via manual browser smoke; everything
// the component depends on for correctness lives here.

describe("getWeekRange (Europe/London, Monday-anchored)", () => {
  it("anchors to Monday when reference is a Wednesday", () => {
    // 2026-05-20 is a Wednesday.
    const week = getWeekRange(new Date("2026-05-20T10:00:00Z"));
    expect(week.days).toHaveLength(7);
    expect(week.days[0]!.dateLabel).toBe("2026-05-18"); // Monday
    expect(week.days[6]!.dateLabel).toBe("2026-05-24"); // Sunday
    expect(week.days[0]!.dayIndex).toBe(0);
    expect(week.days[6]!.dayIndex).toBe(6);
  });

  it("anchors to Monday when reference is a Sunday (does not roll forward)", () => {
    // 2026-05-24 is a Sunday.
    const week = getWeekRange(new Date("2026-05-24T15:00:00Z"));
    expect(week.days[0]!.dateLabel).toBe("2026-05-18");
    expect(week.days[6]!.dateLabel).toBe("2026-05-24");
  });

  it("anchors to itself when reference is a Monday", () => {
    const week = getWeekRange(new Date("2026-05-18T00:00:00Z"));
    expect(week.days[0]!.dateLabel).toBe("2026-05-18");
  });

  it("spans the Europe/London BST→GMT transition cleanly (last Sunday of Oct)", () => {
    // Clocks go back 2026-10-25 02:00 BST → 01:00 GMT. Week containing
    // Oct 25 should still be Mon Oct 19 → Sun Oct 25.
    const week = getWeekRange(new Date("2026-10-25T13:00:00Z"));
    expect(week.days[0]!.dateLabel).toBe("2026-10-19");
    expect(week.days[6]!.dateLabel).toBe("2026-10-25");
  });

  it("spans the GMT→BST transition cleanly (last Sunday of March)", () => {
    // Clocks go forward 2026-03-29 01:00 GMT → 02:00 BST. Week containing
    // Mar 29 should still be Mon Mar 23 → Sun Mar 29.
    const week = getWeekRange(new Date("2026-03-29T12:00:00Z"));
    expect(week.days[0]!.dateLabel).toBe("2026-03-23");
    expect(week.days[6]!.dateLabel).toBe("2026-03-29");
  });
});

describe("parseWeekAnchor / shiftWeek", () => {
  it("parses a well-formed YYYY-MM-DD into a noon-UTC Date", () => {
    const d = parseWeekAnchor("2026-05-18");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-05-18T12:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(parseWeekAnchor(null)).toBeNull();
    expect(parseWeekAnchor(undefined)).toBeNull();
    expect(parseWeekAnchor("")).toBeNull();
    expect(parseWeekAnchor("2026-5-18")).toBeNull();
    expect(parseWeekAnchor("18/05/2026")).toBeNull();
    expect(parseWeekAnchor("not a date")).toBeNull();
  });

  it("shifts whole weeks forward + backward", () => {
    const base = new Date("2026-05-18T12:00:00Z");
    expect(shiftWeek(base, 1).toISOString()).toBe("2026-05-25T12:00:00.000Z");
    expect(shiftWeek(base, -1).toISOString()).toBe("2026-05-11T12:00:00.000Z");
    expect(shiftWeek(base, 0).toISOString()).toBe(base.toISOString());
  });
});

describe("appointmentToChunks", () => {
  const week = getWeekRange(new Date("2026-05-20T12:00:00Z")); // Mon 18 → Sun 24

  it("returns one chunk for a same-day appointment in the visible week", () => {
    // 8am BST = 7am UTC (May → BST)
    const chunks = appointmentToChunks(
      { startsAtIso: "2026-05-19T07:00:00Z", endsAtIso: "2026-05-19T09:00:00Z" },
      week,
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.dayIndex).toBe(1); // Tuesday
    expect(chunks[0]!.startMins).toBe(8 * 60); // 8 am local
    expect(chunks[0]!.endMins).toBe(10 * 60); // 10 am local
  });

  it("returns empty when the appointment is before the week", () => {
    const chunks = appointmentToChunks(
      { startsAtIso: "2026-05-10T07:00:00Z", endsAtIso: "2026-05-10T09:00:00Z" },
      week,
    );
    expect(chunks).toEqual([]);
  });

  it("returns empty when the appointment is after the week", () => {
    const chunks = appointmentToChunks(
      { startsAtIso: "2026-06-01T07:00:00Z", endsAtIso: "2026-06-01T09:00:00Z" },
      week,
    );
    expect(chunks).toEqual([]);
  });

  it("returns empty when end <= start", () => {
    const chunks = appointmentToChunks(
      { startsAtIso: "2026-05-19T09:00:00Z", endsAtIso: "2026-05-19T08:00:00Z" },
      week,
    );
    expect(chunks).toEqual([]);
  });

  it("splits a midnight-spanning appointment into two day chunks", () => {
    // 11pm local Mon → 1am local Tue = 22:00 UTC Mon → 00:00 UTC Tue (BST = UTC+1)
    const chunks = appointmentToChunks(
      { startsAtIso: "2026-05-18T22:00:00Z", endsAtIso: "2026-05-19T00:00:00Z" },
      week,
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.dayIndex).toBe(0); // Monday chunk
    expect(chunks[0]!.startMins).toBe(23 * 60); // 11 pm
    expect(chunks[0]!.endMins).toBe(24 * 60); // up to local midnight
    expect(chunks[1]!.dayIndex).toBe(1); // Tuesday chunk
    expect(chunks[1]!.startMins).toBe(0); // midnight
    expect(chunks[1]!.endMins).toBe(1 * 60); // 1 am
  });

  it("ignores malformed ISO strings", () => {
    expect(appointmentToChunks({ startsAtIso: "nope", endsAtIso: "alsonope" }, week)).toEqual([]);
  });
});

describe("assignOverlapColumns", () => {
  it("returns [] for empty input", () => {
    expect(assignOverlapColumns([])).toEqual([]);
  });

  it("assigns colIndex 0 + colCount 1 to a single block", () => {
    const out = assignOverlapColumns([{ startMins: 540, endMins: 600 }]);
    expect(out).toEqual([{ startMins: 540, endMins: 600, colIndex: 0, colCount: 1 }]);
  });

  it("reuses column 0 for non-overlapping blocks", () => {
    const out = assignOverlapColumns([
      { startMins: 540, endMins: 600 }, // 9-10
      { startMins: 660, endMins: 720 }, // 11-12 (no overlap)
    ]);
    expect(out.map((x) => x.colIndex)).toEqual([0, 0]);
    expect(out.map((x) => x.colCount)).toEqual([1, 1]);
  });

  it("assigns two overlapping blocks to columns 0 and 1, both colCount 2", () => {
    const out = assignOverlapColumns([
      { startMins: 540, endMins: 660 }, // 9-11
      { startMins: 600, endMins: 720 }, // 10-12 (overlaps)
    ]);
    expect(out.find((x) => x.startMins === 540)!.colIndex).toBe(0);
    expect(out.find((x) => x.startMins === 600)!.colIndex).toBe(1);
    expect(out.every((x) => x.colCount === 2)).toBe(true);
  });

  it("handles three-way concurrent overlap", () => {
    const out = assignOverlapColumns([
      { startMins: 540, endMins: 720 }, // 9-12
      { startMins: 600, endMins: 720 }, // 10-12
      { startMins: 630, endMins: 720 }, // 10:30-12
    ]);
    expect(out.every((x) => x.colCount === 3)).toBe(true);
    const cols = out.map((x) => x.colIndex).sort();
    expect(cols).toEqual([0, 1, 2]);
  });

  it("staircase A-B-C (A overlaps B, B overlaps C, A does not overlap C) shares one cluster of size 2", () => {
    // A: 9-11, B: 10-12, C: 11:30-13. A doesn't overlap C, but the
    // cluster is A+B+C since B bridges them — colCount should be 2
    // (max concurrent), not 3.
    const out = assignOverlapColumns([
      { startMins: 540, endMins: 660 }, // A 9-11
      { startMins: 600, endMins: 720 }, // B 10-12
      { startMins: 690, endMins: 780 }, // C 11:30-13
    ]);
    // A gets col 0; B can't reuse (overlaps A) → col 1; C reuses col 0
    // because A has ended by 11:30.
    expect(out.find((x) => x.startMins === 540)!.colIndex).toBe(0);
    expect(out.find((x) => x.startMins === 600)!.colIndex).toBe(1);
    expect(out.find((x) => x.startMins === 690)!.colIndex).toBe(0);
    // Cluster spans 9-13, max concurrent = 2 → colCount 2 for all.
    expect(out.every((x) => x.colCount === 2)).toBe(true);
  });

  it("two non-overlapping clusters in the same day get independent colCounts", () => {
    const out = assignOverlapColumns([
      { startMins: 540, endMins: 600 }, // cluster A: single block 9-10
      { startMins: 780, endMins: 900 }, // cluster B: 13-15 (overlapping pair)
      { startMins: 840, endMins: 960 }, // cluster B: 14-16
    ]);
    const a = out.find((x) => x.startMins === 540)!;
    const b1 = out.find((x) => x.startMins === 780)!;
    const b2 = out.find((x) => x.startMins === 840)!;
    expect(a.colCount).toBe(1);
    expect(b1.colCount).toBe(2);
    expect(b2.colCount).toBe(2);
  });
});

describe("computeBlockPosition", () => {
  it("places a block at the top of view at topPct 0", () => {
    const out = computeBlockPosition(7 * 60, 8 * 60, 7 * 60, 19 * 60);
    expect(out.topPct).toBeCloseTo(0);
    expect(out.heightPct).toBeCloseTo((1 / 12) * 100);
  });

  it("a block spanning the full view returns heightPct 100", () => {
    const out = computeBlockPosition(7 * 60, 19 * 60, 7 * 60, 19 * 60);
    expect(out.topPct).toBe(0);
    expect(out.heightPct).toBe(100);
  });

  it("clamps a block that starts before the view to topPct 0", () => {
    const out = computeBlockPosition(6 * 60, 8 * 60, 7 * 60, 19 * 60);
    expect(out.topPct).toBe(0);
    expect(out.heightPct).toBeCloseTo((1 / 12) * 100);
  });

  it("clamps a block that extends past the view to viewEnd", () => {
    const out = computeBlockPosition(18 * 60, 22 * 60, 7 * 60, 19 * 60);
    expect(out.topPct).toBeCloseTo((11 / 12) * 100);
    expect(out.heightPct).toBeCloseTo((1 / 12) * 100);
  });

  it("returns zero-height for a block entirely before the view", () => {
    const out = computeBlockPosition(4 * 60, 5 * 60, 7 * 60, 19 * 60);
    expect(out.heightPct).toBe(0);
  });

  it("returns zero-height for a degenerate view (start >= end)", () => {
    const out = computeBlockPosition(8 * 60, 9 * 60, 12 * 60, 12 * 60);
    expect(out).toEqual({ topPct: 0, heightPct: 0 });
  });
});

describe("formatHourLabel", () => {
  it.each([
    [0, "12 am"],
    [1, "1 am"],
    [11, "11 am"],
    [12, "12 pm"],
    [13, "1 pm"],
    [17, "5 pm"],
    [23, "11 pm"],
  ])("formats hour %i as '%s'", (hour, expected) => {
    expect(formatHourLabel(hour)).toBe(expected);
  });

  it("normalises out-of-range hours", () => {
    expect(formatHourLabel(24)).toBe("12 am");
    expect(formatHourLabel(-1)).toBe("11 pm");
  });
});

describe("expandViewHours", () => {
  it("returns the defaults when no chunks are out of range", () => {
    const out = expandViewHours(
      [{ startMins: 9 * 60, endMins: 10 * 60 }],
      7,
      19,
    );
    expect(out).toEqual({ startHour: 7, endHour: 19 });
  });

  it("expands the start hour for an early-morning chunk", () => {
    const out = expandViewHours(
      [{ startMins: 5 * 60 + 30, endMins: 7 * 60 }],
      7,
      19,
    );
    expect(out.startHour).toBe(5);
  });

  it("expands the end hour for a late-evening chunk", () => {
    const out = expandViewHours(
      [{ startMins: 18 * 60, endMins: 21 * 60 + 15 }],
      7,
      19,
    );
    expect(out.endHour).toBe(22);
  });

  it("clamps expansion to [0, 24]", () => {
    const out = expandViewHours(
      [{ startMins: -60, endMins: 25 * 60 }],
      7,
      19,
    );
    expect(out.startHour).toBe(0);
    expect(out.endHour).toBe(24);
  });
});
