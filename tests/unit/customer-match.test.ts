import { describe, expect, it } from "vitest";
import { findCustomerMatchCandidates, normalizeMatchPhone, normalizeMatchPostcode } from "@/modules/crm/lib/customer-match";
import type { Customer } from "@/modules/crm/types";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "customer-1",
    tenant_id: "tenant-1",
    full_name: "Jane Smith",
    phone: "07777123456",
    email: "jane@example.com",
    address_line1: "1 High Street",
    address_line2: null,
    city: null,
    postcode: "UB8 1AA",
    property_type: null,
    occupancy_type: null,
    source: null,
    source_enum: null,
    referral_notes: null,
    notes: null,
    archived: false,
    is_demo: false,
    demo_scenario_key: null,
    created_at: "2026-06-25T08:00:00.000Z",
    updated_at: "2026-06-25T08:00:00.000Z",
    ...overrides,
  } as Customer;
}

describe("customer match helpers", () => {
  it("normalizes phone and postcode values", () => {
    expect(normalizeMatchPhone("07777 123-456")).toBe("07777123456");
    expect(normalizeMatchPostcode("ub8 1aa")).toBe("UB81AA");
  });

  it("prioritizes exact phone and email matches", () => {
    const matches = findCustomerMatchCandidates(
      { fullName: "Jane", phone: "07777 123456", email: "other@example.com", postcode: "UB8 1AA" },
      [
        customer({ id: "customer-2", full_name: "Jane Other", phone: "07000000000", email: "other@example.com" }),
        customer({ id: "customer-1" }),
      ],
    );

    expect(matches.map((match) => match.customer.id)).toEqual(["customer-1", "customer-2"]);
    expect(matches[0]?.reasons).toContain("same phone");
  });

  it("returns no candidates when there is not enough evidence", () => {
    expect(findCustomerMatchCandidates({ fullName: "Jo" }, [customer()])).toEqual([]);
  });
});
