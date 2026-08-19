import { beforeEach, describe, expect, it, vi } from "vitest";

// Parsing cover for the CustomerJourneys conversation read.
//
// Lives in its own file: the bridge suite mocks the whole customerjourneys
// module, and vitest module mocks are registered per-file, so these tests would
// otherwise exercise the mock rather than the real parser.

describe("conversation detail parsing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("reads identity out of the runtime booking state", async () => {
    const payload = {
      conversation: { id: "conv-1" },
      messages: [
        { id: "m1", direction: "inbound", body: "hello", channel: "webchat", createdAt: "2026-08-19T09:00:00Z" },
        { id: "m2", direction: "outbound", body: "hi there", channel: "webchat", createdAt: "2026-08-19T09:00:05Z" },
        { id: "m3", direction: "inbound", body: "   ", channel: "webchat", createdAt: null },
      ],
      bookingState: {
        currentState: "awaiting_slot_confirmation",
        collectedData: {
          identity: {
            fullName: "Leah Ryder",
            phoneNumber: "07792754234",
            email: "lryder1987@yahoo.co.uk",
            postcode: "HA4 8RJ",
          },
          service: { serviceKey: "boiler-repair", serviceName: "Boiler repair" },
        },
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })),
    );
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: () => ({ crmE2ePlatformFixturesEnabled: false }),
    }));

    const { fetchCustomerJourneysConversation } = await import("@/modules/crm/lib/customerjourneys");
    const detail = await fetchCustomerJourneysConversation(
      {
        customerjourneys_tenant_id: "cj-tenant-1",
        platform_api_base_url: "https://platform.example",
        auth_mode: "internal_service",
      } as never,
      "conv-1",
    );

    expect(detail?.identity).toEqual({
      fullName: "Leah Ryder",
      phoneNumber: "07792754234",
      email: "lryder1987@yahoo.co.uk",
      postcode: "HA4 8RJ",
      address: null,
    });
    // Blank-bodied rows are dropped so they don't render as empty bubbles.
    expect(detail?.messages).toHaveLength(2);
    expect(detail?.service.serviceName).toBe("Boiler repair");
    expect(detail?.currentState).toBe("awaiting_slot_confirmation");

    vi.unstubAllGlobals();
  });

  it("returns null rather than throwing when the tenant has no runtime link", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: () => ({ crmE2ePlatformFixturesEnabled: false }),
    }));

    const { fetchCustomerJourneysConversation } = await import("@/modules/crm/lib/customerjourneys");

    await expect(fetchCustomerJourneysConversation(null, "conv-1")).resolves.toBeNull();
  });
});

