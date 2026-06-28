import { describe, expect, it } from "vitest";
import { getEnquiryWorkItemSummary } from "@/modules/crm/lib/enquiry-work-item";
import type { LeadWithRelations } from "@/modules/crm/types";

function lead(overrides: Partial<LeadWithRelations> = {}): LeadWithRelations {
  return {
    id: "lead-1",
    customer_id: "customer-1",
    service_id: "service-1",
    job_type_id: "job-type-1",
    status: "new",
    lost_reason: null,
    source: "Manual phone call",
    assigned_to: null,
    next_action_at: null,
    notes: "Customer needs help.",
    problem_description: "Boiler losing pressure.",
    affected_area: null,
    urgency_level: "same_day",
    preferred_date_text: null,
    preferred_time_window: null,
    intake_source: "manual_crm",
    submission_fingerprint: null,
    submission_count: 1,
    first_submitted_at: null,
    last_submitted_at: null,
    possible_duplicate_customer_id: null,
    matched_customer_confidence: null,
    customer_match_result: null,
    dedupe_result: null,
    created_at: "2026-06-23T10:00:00.000Z",
    updated_at: "2026-06-23T10:00:00.000Z",
    customer: {
      id: "customer-1",
      full_name: "Alina Bokach",
      phone: "07760303990",
      email: "abokach@example.com",
      address_line1: null,
      postcode: "UB8 1AA",
    },
    service: { id: "service-1", name: "Boilers" },
    job_type: { id: "job-type-1", name: "Boiler repair" },
    owner: null,
    possible_duplicate_customer: null,
    ...overrides,
  };
}

describe("getEnquiryWorkItemSummary", () => {
  it("summarizes an enquiry around the operator's next decision", () => {
    const summary = getEnquiryWorkItemSummary(
      lead({
        owner: { id: "profile-1", full_name: "Office Owner", role: "admin" },
      }),
    );

    expect(summary).toEqual({
      title: "Alina Bokach",
      reason: "Boiler losing pressure.",
      contactLine: "07760303990 · abokach@example.com",
      contextLine: "Boilers · Boiler repair · Same Day · Manual phone call",
      ownerLabel: "Office Owner",
      receivedLabel: "Received 23 Jun 2026",
      dueLabel: "No next action set",
      primaryActionLabel: "Review",
    });
  });

  it("falls back cleanly for unlinked enquiries with sparse data", () => {
    const summary = getEnquiryWorkItemSummary(
      lead({
        customer_id: null,
        customer: null,
        service: null,
        job_type: null,
        source: null,
        assigned_to: "11111111-1111-4111-8111-111111111111",
        notes: null,
        problem_description: null,
        urgency_level: null,
      }),
    );

    expect(summary.title).toBe("Unlinked enquiry");
    expect(summary.reason).toBe("No problem captured yet.");
    expect(summary.contactLine).toBe("No phone or email");
    expect(summary.contextLine).toBe("Service TBC · No source");
    expect(summary.ownerLabel).toBe("Assigned");
  });
});
