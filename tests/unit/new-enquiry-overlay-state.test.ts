import { describe, expect, it } from "vitest";
import {
  newEnquiryOverlayHref,
  queueNewEnquiry,
  shouldShowNewEnquiryInsert,
  toRealtimeLeadInsert,
} from "@/modules/crm/components/client/new-enquiry-overlay-state";

const leadRow = {
  id: "lead-1",
  tenant_id: "tenant-1",
  status: "new",
  source: "Website booking form",
  created_at: "2026-06-24T10:00:00.000Z",
};

describe("new enquiry overlay state", () => {
  it("accepts tenant-scoped To-do lead inserts", () => {
    expect(
      shouldShowNewEnquiryInsert(leadRow, {
        tenantId: "tenant-1",
        dismissedIds: new Set(),
        queuedIds: new Set(),
      }),
    ).toBe(true);
  });

  it("rejects rows outside the active tenant or To-do statuses", () => {
    expect(
      shouldShowNewEnquiryInsert({ ...leadRow, tenant_id: "tenant-2" }, {
        tenantId: "tenant-1",
        dismissedIds: new Set(),
        queuedIds: new Set(),
      }),
    ).toBe(false);
    expect(
      shouldShowNewEnquiryInsert({ ...leadRow, status: "booked" }, {
        tenantId: "tenant-1",
        dismissedIds: new Set(),
        queuedIds: new Set(),
      }),
    ).toBe(false);
  });

  it("rejects dismissed and already queued lead IDs", () => {
    expect(
      shouldShowNewEnquiryInsert(leadRow, {
        tenantId: "tenant-1",
        dismissedIds: new Set(["lead-1"]),
        queuedIds: new Set(),
      }),
    ).toBe(false);
    expect(
      shouldShowNewEnquiryInsert(leadRow, {
        tenantId: "tenant-1",
        dismissedIds: new Set(),
        queuedIds: new Set(["lead-1"]),
      }),
    ).toBe(false);
  });

  it("normalizes realtime lead inserts and ignores malformed rows", () => {
    expect(toRealtimeLeadInsert(leadRow)).toEqual({
      id: "lead-1",
      tenant_id: "tenant-1",
      status: "new",
      source: "Website booking form",
      created_at: "2026-06-24T10:00:00.000Z",
      problem_description: null,
      notes: null,
    });
    expect(toRealtimeLeadInsert({ ...leadRow, id: null })).toBeNull();
  });

  it("deduplicates queue entries and keeps the newest three", () => {
    const current = [{ id: "lead-1" }, { id: "lead-2" }, { id: "lead-3" }];

    expect(queueNewEnquiry(current, { id: "lead-4" })).toEqual([
      { id: "lead-4" },
      { id: "lead-1" },
      { id: "lead-2" },
    ]);
    expect(queueNewEnquiry(current, { id: "lead-2" })).toEqual([
      { id: "lead-2" },
      { id: "lead-1" },
      { id: "lead-3" },
    ]);
  });

  it("builds the highlighted To-do route for review", () => {
    expect(newEnquiryOverlayHref("lead 1")).toBe("/leads?tab=todo&highlight=lead%201");
  });
});
