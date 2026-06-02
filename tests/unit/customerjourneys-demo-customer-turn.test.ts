import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCustomerJourneysDemoCustomerTurn } from "@/modules/crm/lib/customerjourneys";

const link = {
  crm_tenant_id: "11111111-1111-4111-8111-111111111111",
  customerjourneys_tenant_id: "22222222-2222-4222-8222-222222222222",
  platform_api_base_url: "https://platform.example.com",
  auth_mode: "internal_service" as const,
  webchat_enabled: true,
  sms_enabled: true,
  whatsapp_enabled: true,
  voice_enabled: true,
  display_sms_number: "+447401248976",
  display_whatsapp_number: "+447401248976",
  display_voice_number: "+447401248976",
  last_readiness_check: {},
  created_at: "2026-06-01T10:00:00.000Z",
  updated_at: "2026-06-01T10:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Customer Journeys demo customer turn bridge", () => {
  it("posts safe scenario facts to the linked platform tenant using the internal token", async () => {
    vi.stubEnv("CUSTOMERJOURNEYS_INTERNAL_API_TOKEN", "internal-test-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        ok: true,
        turn: {
          status: "message",
          stopCode: "next_message",
          reason: "Answered from platform AI.",
          message: "My phone is +447779305853 and the postcode is UB8 1AA.",
        },
      }),
    );

    const turn = await generateCustomerJourneysDemoCustomerTurn(link, {
      scenarioKey: "emergency_repair_booking",
      prospectName: "Shaz Iqbal",
      prospectPhone: "+447779305853",
      turnIndex: 1,
      transcript: [
        {
          id: "m1",
          direction: "outbound",
          body: "Can I get your phone number and postcode?",
        },
      ],
    });

    expect(turn).toMatchObject({
      status: "message",
      message: "My phone is +447779305853 and the postcode is UB8 1AA.",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://platform.example.com/v1/internal/demo/customer-turn",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-internal-service-token": "internal-test-token",
        }),
        body: expect.stringContaining('"tenantId":"22222222-2222-4222-8222-222222222222"'),
      }),
    );
    expect(String(fetchSpy.mock.calls[0]?.[1]?.body)).toContain('"scenarioFacts"');
    expect(String(fetchSpy.mock.calls[0]?.[1]?.body)).not.toContain("GOOGLE_AI_API_KEY");
  });
});
