import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  summariseConversationForLead,
  type CustomerJourneysConversationDetail,
} from "@/modules/crm/lib/customerjourneys";

// Cover for the public webchat -> CRM enquiry bridge.
//
// 2026-08-19: an escalated webchat landed in Enquiries as a single line ("I want
// a time on Thursday") with no name, phone or email — even though the agent had
// collected all three earlier in the chat. Cause: `POST /v1/webchat/messages`
// returns only the two messages in the current turn, so the identity dig over
// that response could never find anything, and the summary was the latest
// inbound message alone. The bridge now reads the full conversation from the
// runtime first.

function makeDetail(): CustomerJourneysConversationDetail {
  return {
    conversationId: "conv-1",
    messages: [
      { id: "m1", direction: "inbound", body: "can I book a boiler repair for tomorrow please?", channel: "webchat", createdAt: null },
      { id: "m2", direction: "outbound", body: "What service do you need help with today?", channel: "webchat", createdAt: null },
      { id: "m3", direction: "inbound", body: "boiler repair", channel: "webchat", createdAt: null },
      { id: "m4", direction: "inbound", body: "I want a time on Thursday", channel: "webchat", createdAt: null },
    ],
    identity: {
      fullName: "Leah Ryder",
      phoneNumber: "07792754234",
      email: "lryder1987@yahoo.co.uk",
      postcode: "HA4 8RJ",
      address: null,
    },
    service: { serviceKey: "boiler-repair", serviceName: "Boiler repair", issueDescription: null },
    currentState: "awaiting_slot_confirmation",
  };
}

const CONVERSATION_ID = "5c1d5e6c-1c2b-4a3d-8e9f-0a1b2c3d4e5f";

// Drives the real POST handler and returns the envelope the bridge published.
async function runBridge(opts: {
  detail?: CustomerJourneysConversationDetail | null;
  fetchThrows?: boolean;
  inboundBody?: string;
}) {
  const processPlatformEvent = vi.fn().mockResolvedValue(undefined);
  const fetchConversation = vi.fn().mockImplementation(async () => {
    if (opts.fetchThrows) throw new Error("runtime down");
    return opts.detail ?? null;
  });

  vi.doMock("@/modules/crm/lib/customerjourneys", async () => {
    const actual = await vi.importActual<typeof import("@/modules/crm/lib/customerjourneys")>(
      "@/modules/crm/lib/customerjourneys",
    );
    return {
      ...actual,
      appendCustomerJourneysWebchatMessage: vi.fn().mockResolvedValue({
        message: { body: opts.inboundBody ?? "I want a time on Thursday", createdAt: "2026-08-19T09:10:00.000Z" },
        replyMessage: {
          body: "I've asked a teammate to pick this up.",
          createdAt: "2026-08-19T09:10:01.000Z",
          metadata: { outcome: "handoff_required", fallbackReason: "agent_loop_detected" },
        },
      }),
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({
        customerjourneys_tenant_id: "cj-tenant-1",
        platform_api_base_url: "https://platform.example",
        auth_mode: "internal_service",
      }),
      fetchCustomerJourneysConversation: fetchConversation,
    };
  });
  vi.doMock("@/modules/platform/lib/processor", () => ({ processPlatformEvent }));
  vi.doMock("@/modules/crm/lib/supabase-server", () => ({
    createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
  }));
  vi.doMock("@/modules/crm/lib/env", () => ({
    getCrmEnv: () => ({ crmE2ePlatformFixturesEnabled: false, enabled: true }),
  }));
  vi.doMock("@/modules/forms/api/landing-tenant", () => ({
    resolveLandingPageTenantId: vi.fn().mockResolvedValue("tenant-1"),
  }));
  vi.doMock("@/lib/origin", () => ({ validateRequestOrigin: () => ({ ok: true }) }));
  vi.doMock("@/lib/rate-limit", () => ({
    consumeRateLimit: vi.fn().mockResolvedValue({ ok: true }),
    rateLimitHeaders: () => ({}),
  }));
  vi.doMock("next/headers", () => ({
    headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
  }));

  const route = await import("@/app/api/public/webchat/messages/route");
  await route.POST(
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: CONVERSATION_ID,
        body: opts.inboundBody ?? "I want a time on Thursday",
      }),
    }),
  );

  // The bridge is fire-and-forget inside the handler; let its microtasks settle.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const envelope = processPlatformEvent.mock.calls[0]?.[1];
  return { envelope, processPlatformEvent };
}

describe("public webchat -> enquiry bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("carries the collected name, phone, email and postcode onto the enquiry", async () => {
    const { envelope } = await runBridge({ detail: makeDetail() });

    expect(envelope?.event_type).toBe("EscalationRaised");
    expect(envelope?.payload).toMatchObject({
      customer_full_name: "Leah Ryder",
      customer_phone: "07792754234",
      customer_email: "lryder1987@yahoo.co.uk",
      customer_postcode: "HA4 8RJ",
      service: "Boiler repair",
    });
  });

  it("writes the whole conversation as the problem description", async () => {
    const { envelope } = await runBridge({ detail: makeDetail() });

    const payload = envelope?.payload as Record<string, string>;
    expect(payload.problem_description).toContain("can I book a boiler repair for tomorrow please?");
    expect(payload.problem_description).toContain("I want a time on Thursday");
    // The single triggering message is still available on its own field.
    expect(payload.latest_customer_message).toBe("I want a time on Thursday");
  });

  it("still records the enquiry when the runtime read fails", async () => {
    const { envelope } = await runBridge({ fetchThrows: true });

    expect(envelope?.event_type).toBe("EscalationRaised");
    expect((envelope?.payload as Record<string, string>).message_summary).toBe("I want a time on Thursday");
  });

  it("does not dedupe a second escalation in the same conversation", async () => {
    const { envelope } = await runBridge({ detail: makeDetail() });

    // The key used to be conversation+type alone, so only the first handoff per
    // conversation was ever recorded.
    expect(envelope?.idempotency_key).toContain("2026-08-19T09:10:01.000Z");
  });
});

describe("summariseConversationForLead", () => {
  it("renders the whole conversation, not just the last message", () => {
    const transcript = summariseConversationForLead(makeDetail(), "I want a time on Thursday");

    expect(transcript).toContain("Customer: can I book a boiler repair for tomorrow please?");
    expect(transcript).toContain("AI: What service do you need help with today?");
    expect(transcript).toContain("Customer: I want a time on Thursday");
  });

  it("falls back to the single message when the runtime returns nothing", () => {
    expect(summariseConversationForLead(null, "I want a time on Thursday")).toBe("I want a time on Thursday");
    expect(
      summariseConversationForLead({ ...makeDetail(), messages: [] }, "I want a time on Thursday"),
    ).toBe("I want a time on Thursday");
  });

  it("trims from the front so the unresolved request at the end survives", () => {
    const detail = makeDetail();
    detail.messages = Array.from({ length: 200 }, (_, i) => ({
      id: `m${i}`,
      direction: "inbound" as const,
      body: `message ${i} ${"x".repeat(80)}`,
      channel: "webchat",
      createdAt: null,
    }));

    const transcript = summariseConversationForLead(detail, "fallback", 1000);

    expect(transcript.length).toBeLessThanOrEqual(1000);
    expect(transcript).toContain("earlier messages trimmed");
    expect(transcript).toContain("message 199");
  });
});

describe("public webchat test-traffic detection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("does not flag a genuine customer who mentions a test", async () => {
    const { isTestConversation } = await import("@/app/api/public/webchat/messages/route");

    // These were all tagged is_test=true by the old /\btest\b/i rule, which then
    // excluded them from availability and put them in scope for test-data
    // cleanup.
    expect(isTestConversation("I need a gas safety test")).toBe(false);
    expect(isTestConversation("the boiler failed its test yesterday")).toBe(false);
    expect(isTestConversation("can you test the pressure while you're here?")).toBe(false);
  });

  it("still flags an explicit test message", async () => {
    const { isTestConversation } = await import("@/app/api/public/webchat/messages/route");

    expect(isTestConversation("this is a test")).toBe(true);
    expect(isTestConversation("This is just a test, ignore")).toBe(true);
    expect(isTestConversation("test message")).toBe(true);
    expect(isTestConversation("testing the chat")).toBe(true);
  });
});
