import { describe, expect, it } from "vitest";
import {
  LiveAgentAuthError,
  LiveAgentNotConfiguredError,
  LiveAgentRequestError,
  createLiveAgentAdapter,
} from "@/modules/crm/lib/ai-hub-live-agent";

const input = {
  tenant_id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "22222222-2222-4222-8222-222222222222",
  conversation_id: "33333333-3333-4333-8333-333333333333",
  channel: "web_chat" as const,
  customer: {
    name: "Jane Smith",
    email: "jane@example.com",
  },
  messages: [
    {
      role: "customer" as const,
      body: "Need a boiler service booking this week.",
      sender_label: "Jane Smith",
      channel: "web_chat" as const,
    },
  ],
};

describe("live agent adapter", () => {
  it("throws when the runtime is not configured", () => {
    expect(() => createLiveAgentAdapter({ url: null, token: null })).toThrow(LiveAgentNotConfiguredError);
  });

  it("maps a successful runtime response", async () => {
    const adapter = createLiveAgentAdapter({
      url: "https://agent.example.com/chat",
      token: "secret-token",
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            assistant_messages: [
              {
                body: "I can help with that. I have booked Thursday 10:00-11:00.",
                sender_label: "AI Web Chat Agent",
                channel: "web_chat",
              },
            ],
            status: "booked",
            qualification: {
              summary: "Boiler service customer ready to book.",
              service: "Boiler service",
            },
            booking: {
              start_at: "2026-04-07T10:00:00.000Z",
              end_at: "2026-04-07T11:00:00.000Z",
              slot_label: "Thu 10:00-11:00",
              booking_uid: "booking-123",
            },
            crm_hints: {
              identity_email: "jane@example.com",
              customer_name: "Jane Smith",
            },
            actions: [
              {
                agent_type: "booking",
                title: "Booking confirmed",
                detail: "The customer accepted the proposed slot.",
                status_label: "completed",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });

    const result = await adapter.send(input);

    expect(result.status).toBe("booked");
    expect(result.booking?.slot_label).toBe("Thu 10:00-11:00");
    expect(result.assistant_messages[0]?.body).toContain("booked Thursday");
  });

  it("throws an auth error for 401/403 responses", async () => {
    const adapter = createLiveAgentAdapter({
      url: "https://agent.example.com/chat",
      token: "secret-token",
      fetchFn: async () => new Response("Unauthorized", { status: 401 }),
    });

    await expect(adapter.send(input)).rejects.toBeInstanceOf(LiveAgentAuthError);
  });

  it("throws a request error on timeout", async () => {
    const adapter = createLiveAgentAdapter({
      url: "https://agent.example.com/chat",
      token: "secret-token",
      timeoutMs: 1,
      fetchFn: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
          });
        }),
    });

    await expect(adapter.send(input)).rejects.toEqual(new LiveAgentRequestError("Live agent runtime request timed out."));
  });
});
