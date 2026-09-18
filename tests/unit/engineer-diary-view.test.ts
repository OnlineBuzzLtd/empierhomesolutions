import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommsoftDiary, addDays, buildDateStrip } from "@/modules/crm/components/commusoft/CommsoftDiary";
import { CommsoftJobEvent } from "@/modules/crm/components/commusoft/CommsoftJobEvent";
import type { EngineerDashboardJob, JobWithRelations, Note } from "@/modules/crm/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

// Engineer-view fixes from the 2026-09-12 operator list:
//   - "Remove recently completed from engineer diary view"
//   - "Can't go back in diary, can only see 2 days previous"
//   - "Engineer can't see notes added to the job"

function job(overrides: Partial<EngineerDashboardJob>): EngineerDashboardJob {
  return {
    id: "job-1",
    title: "Boiler service",
    status: "booked",
    scheduled_date: "2026-09-12",
    scheduled_time: "09:00",
    customer: { full_name: "Jackie White", address_line1: "1 High St", postcode: "RG27 0NS" },
    ...overrides,
  } as unknown as EngineerDashboardJob;
}

describe("engineer diary — date navigation", () => {
  it("still opens on today with two days of lookback", () => {
    const today = new Date("2026-09-12T10:00:00");
    const strip = buildDateStrip(addDays(today, -2));

    expect(strip).toHaveLength(7);
    expect(strip[0].getDate()).toBe(10);
    expect(strip[2].getDate()).toBe(12);
    expect(strip[6].getDate()).toBe(16);
  });

  it("can be moved back a week, and a month, to reach old job reports", () => {
    // Previously impossible: the strip was pinned to today-2 and there were no
    // controls, so a report from last week could never be opened from the diary.
    const today = new Date("2026-09-12T10:00:00");
    const lastWeek = buildDateStrip(addDays(addDays(today, -2), -7));
    expect(lastWeek[0].toISOString().slice(0, 10)).toBe("2026-09-03");

    const fourWeeksBack = buildDateStrip(addDays(addDays(today, -2), -28));
    expect(fourWeeksBack[0].toISOString().slice(0, 10)).toBe("2026-08-13");
  });

  it("crosses month boundaries without duplicating or skipping days", () => {
    const strip = buildDateStrip(new Date("2026-08-29T10:00:00"));
    expect(strip.map((d) => d.getDate())).toEqual([29, 30, 31, 1, 2, 3, 4]);
  });
});

describe("engineer diary — render", () => {
  it("renders navigation controls and no 'Recent completed' section", () => {
    const html = renderToStaticMarkup(
      createElement(CommsoftDiary, {
        jobs: [job({}), job({ id: "job-2", status: "completed", title: "Old completed job" })],
      }),
    );

    expect(html).toContain('aria-label="Earlier week"');
    expect(html).toContain('aria-label="Later week"');
    expect(html).not.toContain("Recent completed");
  });

  it("still lists a completed job under its own date rather than hiding it", () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const html = renderToStaticMarkup(
      createElement(CommsoftDiary, {
        jobs: [job({ id: "job-2", status: "completed", title: "Completed today", scheduled_date: todayKey })],
      }),
    );

    // The block is gone but the job is not: completed work stays reachable on the
    // day it happened, which is how the engineer gets back to its report.
    expect(html).toContain("Completed today");
  });
});

describe("engineer job screen — notes", () => {
  function render(notes: Note[]) {
    const fixtureJob = {
      id: "job-1",
      title: "Boiler service",
      status: "booked",
      scheduled_date: "2026-09-12",
      scheduled_time: "09:00",
      customer: { id: "c1", full_name: "Jackie White", phone: "07700 900111", address_line1: "1 High St", postcode: "RG27 0NS" },
      site: null,
      site_contact: null,
      service: { name: "Boiler service" },
      job_type: null,
      started_at: null,
    } as unknown as JobWithRelations;

    return renderToStaticMarkup(
      createElement(CommsoftJobEvent, {
        job: fixtureJob,
        notes,
        attachments: [],
        expenses: [],
        payments: [],
        quote: null,
        invoice: null,
        aiAccess: { enabled: false } as never,
        canDeleteAttachments: false,
      }),
    );
  }

  it("shows the office's notes to the engineer", () => {
    // Notes were loaded and passed into this component but never rendered, so an
    // engineer on the default view never saw "gate code 1234" or "parts on order".
    const html = render([
      { id: "n1", entity_type: "job", entity_id: "job-1", body: "Gate code 1234 — dog in garden", created_by: null, created_at: "2026-09-11T09:00:00Z" },
      { id: "n2", entity_type: "job", entity_id: "job-1", body: "Parts already ordered", created_by: null, created_at: "2026-09-11T10:00:00Z" },
    ]);

    expect(html).toContain("Notes (2)");
    expect(html).toContain("Gate code 1234");
    expect(html).toContain("Parts already ordered");
  });

  it("renders an empty state and the add-note form when there are none", () => {
    const html = render([]);

    expect(html).toContain("Notes (0)");
    expect(html).toContain("No notes on this job yet.");
    expect(html).toContain("engineer-job-notes");
  });
});
