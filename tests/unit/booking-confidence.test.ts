import { describe, expect, it } from "vitest";
import { buildBookingConfidence } from "@/modules/crm/lib/booking-confidence";
import type { LeadWithRelations } from "@/modules/crm/types";

function lead(overrides: Partial<LeadWithRelations> = {}): LeadWithRelations {
  return {
    id: "lead-1",
    tenant_id: "tenant-1",
    customer_id: "customer-1",
    possible_duplicate_customer_id: null,
    service_id: "service-1",
    job_type_id: "job-type-1",
    assigned_to: "user-1",
    status: "new",
    source: "Manual",
    source_enum: "manual",
    next_action_at: null,
    notes: null,
    problem_description: "Boiler leaking.",
    affected_area: null,
    urgency_level: "same_day",
    preferred_date_text: "Tomorrow",
    preferred_time_window: "AM",
    intake_source: "manual_crm",
    dedupe_result: null,
    submission_count: 1,
    customer_match_result: "matched",
    is_demo: false,
    demo_scenario_key: null,
    created_at: "2026-06-25T08:00:00.000Z",
    updated_at: "2026-06-25T08:00:00.000Z",
    customer: {
      id: "customer-1",
      full_name: "Jane Smith",
      phone: "07777123456",
      email: null,
      address_line1: "1 High Street",
      postcode: "UB8 1AA",
    },
    service: { id: "service-1", name: "Boilers" },
    job_type: { id: "job-type-1", name: "Boiler repair" },
    ...overrides,
  } as LeadWithRelations;
}

describe("buildBookingConfidence", () => {
  it("marks complete enquiry details as ready to book", () => {
    const confidence = buildBookingConfidence(lead(), { engineerCount: 2 });

    expect(confidence.level).toBe("ready");
    expect(confidence.label).toBe("Ready to book");
    expect(confidence.checks.every((check) => check.state === "ok")).toBe(true);
    expect(confidence.suggestedWindows).toEqual(["Tomorrow, AM", "Next available engineer after Tomorrow"]);
  });

  it("blocks risky bookings with no contact or problem details", () => {
    const confidence = buildBookingConfidence(
      lead({
        customer: { id: "customer-1", full_name: "Jane Smith", phone: null, email: null, address_line1: null, postcode: null },
        problem_description: null,
        notes: null,
      }),
      { engineerCount: 1 },
    );

    expect(confidence.level).toBe("risky");
    expect(confidence.checks.filter((check) => check.state === "missing").map((check) => check.label)).toEqual([
      "Contact",
      "Problem",
    ]);
  });

  it("warns before confirming possible duplicate customers", () => {
    const confidence = buildBookingConfidence(
      lead({ customer_match_result: "possible_duplicate", possible_duplicate_customer_id: "customer-2" }),
      { engineerCount: 2 },
    );

    expect(confidence.level).toBe("risky");
    expect(confidence.checks[0]).toMatchObject({ label: "Duplicate", state: "warning" });
  });

  it("warns when nobody owns the booking action yet", () => {
    const confidence = buildBookingConfidence(lead({ assigned_to: null }), { engineerCount: 2 });

    expect(confidence.level).toBe("needs_info");
    expect(confidence.checks).toContainEqual({
      label: "Owner",
      state: "warning",
      detail: "Claim or assign this before confirming the booking.",
    });
  });
});
