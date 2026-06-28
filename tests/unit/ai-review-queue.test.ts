import { describe, expect, it } from "vitest";
import { summarizeAiBusinessOutcomes, summarizeAiReviewQueue } from "@/modules/crm/lib/ai-review-queue";
import type { BookingRecoveryCase } from "@/modules/platform/lib/booking-recovery";
import type { PlatformConversationRecord } from "@/modules/platform/lib/repository";

function recoveryCase(overrides: Partial<BookingRecoveryCase> = {}): BookingRecoveryCase {
  return {
    id: "case-1",
    eventId: "event-1",
    appointmentId: "appointment-1",
    bookingId: "booking-1",
    channel: "webchat",
    customerName: "Jane Smith",
    phone: "07777123456",
    email: "jane@example.com",
    address: null,
    postcode: "UB8 1AA",
    service: "Boiler repair",
    startsAt: "2099-06-25T09:00:00.000Z",
    endsAt: "2099-06-25T10:00:00.000Z",
    reason: "Booking is on Scheduler but is not linked to a customer, enquiry, and job.",
    conflictingCustomerId: null,
    ...overrides,
  };
}

function conversation(overrides: Partial<PlatformConversationRecord> = {}): PlatformConversationRecord {
  return {
    link: {
      id: "link-1",
      workspace_id: "workspace-1",
      tenant_id: "tenant-1",
      conversation_id: "conversation-1",
      customer_id: "customer-1",
      lead_id: "lead-1",
      job_id: "job-1",
      callback_appointment_id: null,
      booking_appointment_id: "appointment-1",
      latest_channel: "webchat",
      identity_phone: "07777123456",
      identity_email: null,
      metadata: {},
      latest_event_at: "2026-06-25T09:00:00.000Z",
      created_at: "2026-06-25T09:00:00.000Z",
      updated_at: "2026-06-25T09:00:00.000Z",
    },
    customer: { id: "customer-1", full_name: "Jane Smith", phone: "07777123456", email: null, postcode: "UB8 1AA" },
    lead: { id: "lead-1", status: "booked", source: "ai_platform", next_action_at: null, updated_at: "2026-06-25T09:00:00.000Z" },
    job: { id: "job-1", title: "Boiler repair", status: "booked", scheduled_date: "2026-06-26" },
    callbackAppointment: null,
    bookingAppointment: { id: "appointment-1", type: "booking", title: "Boiler repair", starts_at: "2026-06-26T10:00:00.000Z", ends_at: "2026-06-26T11:00:00.000Z", status: "scheduled" },
    ...overrides,
  };
}

describe("summarizeAiReviewQueue", () => {
  it("counts conflicts, missing links, and upcoming bookings", () => {
    expect(
      summarizeAiReviewQueue([
        recoveryCase({ conflictingCustomerId: "customer-1" }),
        recoveryCase({ id: "case-2", startsAt: null, reason: "Needs office review." }),
      ]),
    ).toEqual({
      totalCount: 2,
      conflictCount: 1,
      upcomingBookingCount: 1,
      missingLinkCount: 2,
      firstAction: "Resolve customer conflicts first",
    });
  });

  it("returns a clear no-review state", () => {
    expect(summarizeAiReviewQueue([])).toEqual({
      totalCount: 0,
      conflictCount: 0,
      upcomingBookingCount: 0,
      missingLinkCount: 0,
      firstAction: "No review needed",
    });
  });
});

describe("summarizeAiBusinessOutcomes", () => {
  it("counts today outcomes and returns no urgent action when linked work is clean", () => {
    expect(summarizeAiBusinessOutcomes([conversation()], [], new Date("2026-06-25T12:00:00.000Z"))).toMatchObject({
      conversationsToday: 1,
      enquiriesToday: 1,
      bookingsToday: 1,
      callbacksToday: 0,
      linkedCustomersToday: 1,
      needsReviewCount: 0,
      firstAction: "No urgent AI action",
    });
  });

  it("prioritizes unsafe booking recovery over conversation link review", () => {
    expect(
      summarizeAiBusinessOutcomes(
        [
          conversation({
            customer: null,
            job: null,
            link: {
              ...conversation().link,
              customer_id: null,
              job_id: null,
            },
          }),
        ],
        [recoveryCase()],
        new Date("2026-06-25T12:00:00.000Z"),
      ),
    ).toMatchObject({
      needsReviewCount: 2,
      firstAction: "Review unsafe bookings",
    });
  });
});
