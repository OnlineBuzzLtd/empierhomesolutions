import { describe, expect, it } from "vitest";
import {
  findBookingRecoveryCustomerCandidates,
  findBookingRecoveryJobCandidates,
} from "@/modules/crm/lib/booking-recovery-matches";
import type { Customer, JobWithRelations } from "@/modules/crm/types";
import type { BookingRecoveryCase } from "@/modules/platform/lib/booking-recovery";

function recovery(overrides: Partial<BookingRecoveryCase> = {}): BookingRecoveryCase {
  return {
    id: "case-1",
    eventId: "event-1",
    appointmentId: "appointment-1",
    bookingId: "booking-1",
    channel: "voice",
    customerName: "Jane Smith",
    phone: "07777 123456",
    email: "jane@example.com",
    address: "1 High Street",
    postcode: "UB8 1AA",
    service: "Boiler",
    startsAt: "2026-06-25T09:00:00.000Z",
    endsAt: "2026-06-25T10:00:00.000Z",
    reason: "Booking is not linked.",
    conflictingCustomerId: null,
    ...overrides,
  };
}

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

function job(overrides: Partial<JobWithRelations> = {}): JobWithRelations {
  return {
    id: "job-1",
    tenant_id: "tenant-1",
    customer_id: "customer-1",
    site_id: null,
    site_contact_id: null,
    service_id: null,
    job_type_id: null,
    lead_id: null,
    title: "Boiler repair",
    description: null,
    scheduled_date: "2026-06-25",
    scheduled_time: "09:00",
    duration_hours: 1,
    status: "booked",
    assigned_engineer: null,
    created_by: null,
    is_demo: false,
    demo_scenario_key: null,
    created_at: "2026-06-25T08:00:00.000Z",
    updated_at: "2026-06-25T08:00:00.000Z",
    customer: { id: "customer-1", full_name: "Jane Smith", phone: "07777123456", email: null, address_line1: null, postcode: "UB8 1AA" },
    service: null,
    job_type: null,
    ...overrides,
  } as JobWithRelations;
}

describe("booking recovery matches", () => {
  it("finds customer candidates from booking identity", () => {
    const matches = findBookingRecoveryCustomerCandidates(recovery(), [customer()]);

    expect(matches[0]?.customer.id).toBe("customer-1");
    expect(matches[0]?.reasons).toContain("same phone");
  });

  it("finds active job candidates from phone, postcode, and work type", () => {
    const matches = findBookingRecoveryJobCandidates(recovery(), [job()]);

    expect(matches[0]?.job.id).toBe("job-1");
    expect(matches[0]?.reasons).toEqual(expect.arrayContaining(["same phone", "same postcode", "similar work"]));
  });
});
