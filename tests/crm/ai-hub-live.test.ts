import { describe, expect, it } from "vitest";
import { buildPlatformEventsFromLiveAgentResult } from "@/modules/crm/lib/ai-hub-live";

const alias = {
  workspace_id: "22222222-2222-4222-8222-222222222222",
  tenant_id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-06-03T10:00:00.000Z",
  updated_at: "2026-06-03T10:00:00.000Z",
};

const session = {
  conversation: {
    id: "33333333-3333-4333-8333-333333333333",
    channel: "web_chat",
    customer_name: "Jane Smith",
    extracted_entities: {
      customer_name: "Jane Smith",
      identity_email: "jane@example.com",
    },
  },
} as never;

describe("live front desk platform events", () => {
  it("uses stable business idempotency keys for live booking events", () => {
    const result = {
      assistant_messages: [{ body: "Booked for Thursday.", channel: "web_chat" }],
      status: "booked",
      qualification: {
        summary: "Customer booked a boiler service.",
        service: "Boiler service",
      },
      booking: {
        start_at: "2026-06-04T10:00:00.000Z",
        end_at: "2026-06-04T11:00:00.000Z",
        slot_label: "Thu 10:00-11:00",
        booking_uid: "booking-123",
      },
      crm_hints: {
        identity_email: "jane@example.com",
        customer_name: "Jane Smith",
      },
      actions: [],
    } as never;

    const first = buildPlatformEventsFromLiveAgentResult({
      alias,
      session,
      result,
      customerMessageBody: "Can you book me in?",
      conversationStarted: false,
    });
    const second = buildPlatformEventsFromLiveAgentResult({
      alias,
      session,
      result,
      customerMessageBody: "Can you book me in?",
      conversationStarted: false,
    });

    expect(first.map((event) => event.idempotency_key)).toEqual([
      "33333333-3333-4333-8333-333333333333:started",
      "33333333-3333-4333-8333-333333333333:qualified",
      "33333333-3333-4333-8333-333333333333:booked:booking-123",
    ]);
    expect(second.map((event) => event.idempotency_key)).toEqual(first.map((event) => event.idempotency_key));
  });

  it("uses a stable escalation key derived from the escalation trigger", () => {
    const events = buildPlatformEventsFromLiveAgentResult({
      alias,
      session,
      result: {
        assistant_messages: [{ body: "I will ask the office to call you.", channel: "web_chat" }],
        status: "escalated",
        qualification: {
          summary: "Customer requested urgent human help.",
          urgency: "urgent_leak",
        },
        actions: [],
      } as never,
      customerMessageBody: "Need urgent help.",
      conversationStarted: true,
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.idempotency_key).toBe("33333333-3333-4333-8333-333333333333:escalated:urgent_leak");
  });
});

