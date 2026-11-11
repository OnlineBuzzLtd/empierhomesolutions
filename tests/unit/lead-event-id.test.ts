import { describe, expect, it } from "vitest";
import { leadMeasurementEventId } from "@/modules/tracking/lead-event-id";

describe("CRM conversion event identity", () => {
  it("returns the same opaque ID for a retry of the same saved lead", () => {
    const first = leadMeasurementEventId("tenant-a", "lead-a");
    expect(first).toMatch(/^ehs_lead_[a-f0-9]{64}$/);
    expect(leadMeasurementEventId("tenant-a", "lead-a")).toBe(first);
    expect(leadMeasurementEventId("tenant-a", "lead-b")).not.toBe(first);
    expect(leadMeasurementEventId("tenant-b", "lead-a")).not.toBe(first);
  });
});
