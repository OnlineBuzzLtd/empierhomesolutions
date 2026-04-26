import { describe, expect, it } from "vitest";
import { resolveCalendarAdminAccessState } from "@/modules/crm/lib/calendar-admin";
import type { CustomerJourneysRuntimeLink } from "@/modules/crm/lib/customerjourneys";

function buildLink(overrides: Partial<CustomerJourneysRuntimeLink> = {}): CustomerJourneysRuntimeLink {
  return {
    crm_tenant_id: "11111111-1111-4111-8111-111111111111",
    customerjourneys_tenant_id: "22222222-2222-4222-8222-222222222222",
    platform_api_base_url: "https://runtime.example.com",
    auth_mode: "internal_service",
    webchat_enabled: true,
    sms_enabled: true,
    whatsapp_enabled: true,
    voice_enabled: true,
    display_sms_number: null,
    display_whatsapp_number: null,
    display_voice_number: null,
    last_readiness_check: {},
    created_at: "2026-04-23T10:00:00.000Z",
    updated_at: "2026-04-23T10:00:00.000Z",
    ...overrides,
  };
}

describe("calendar control-plane access state", () => {
  it("reports a missing runtime link before any env fallback", () => {
    const state = resolveCalendarAdminAccessState(null, {
      customerJourneysPlatformApiBaseUrl: "https://runtime.example.com",
      customerJourneysPlatformApiBaseUrlOverride: null,
      customerJourneysInternalApiToken: "internal-token",
    });

    expect(state.status).toBe("missing_runtime_link");
    expect(state.ready).toBe(false);
    expect(state.message).toContain("Platform runtime link is not configured");
  });

  it("reports a missing platform tenant id when the link is incomplete", () => {
    const state = resolveCalendarAdminAccessState(buildLink({ customerjourneys_tenant_id: null }), {
      customerJourneysPlatformApiBaseUrl: "https://runtime.example.com",
      customerJourneysPlatformApiBaseUrlOverride: null,
      customerJourneysInternalApiToken: "internal-token",
    });

    expect(state.status).toBe("missing_platform_tenant_id");
    expect(state.ready).toBe(false);
    expect(state.message).toContain("no CustomerJourneys tenant id");
  });

  it("reports a missing platform base URL when neither link nor env provides one", () => {
    const state = resolveCalendarAdminAccessState(buildLink({ platform_api_base_url: null }), {
      customerJourneysPlatformApiBaseUrl: null,
      customerJourneysPlatformApiBaseUrlOverride: null,
      customerJourneysInternalApiToken: "internal-token",
    });

    expect(state.status).toBe("missing_platform_base_url");
    expect(state.ready).toBe(false);
    expect(state.message).toBe("Platform API base URL is not configured for this tenant.");
  });

  it("reports a missing internal token for a linked tenant", () => {
    const state = resolveCalendarAdminAccessState(buildLink(), {
      customerJourneysPlatformApiBaseUrl: "https://runtime.example.com",
      customerJourneysPlatformApiBaseUrlOverride: null,
      customerJourneysInternalApiToken: null,
    });

    expect(state.status).toBe("missing_internal_token");
    expect(state.ready).toBe(false);
    expect(state.message).toContain("CUSTOMERJOURNEYS_INTERNAL_API_TOKEN");
  });

  it("returns ready when the link, base URL and internal token are all present", () => {
    const state = resolveCalendarAdminAccessState(
      buildLink({ platform_api_base_url: "https://runtime.example.com/" }),
      {
        customerJourneysPlatformApiBaseUrl: null,
        customerJourneysPlatformApiBaseUrlOverride: null,
        customerJourneysInternalApiToken: "internal-token",
      },
    );

    expect(state.status).toBe("ready");
    expect(state.ready).toBe(true);
    expect(state.message).toBeNull();
    expect(state.baseUrl).toBe("https://runtime.example.com");
    expect(state.platformTenantId).toBe("22222222-2222-4222-8222-222222222222");
    expect(state.internalToken).toBe("internal-token");
  });

  it("prefers the process-wide base-url override over the tenant runtime link", () => {
    const state = resolveCalendarAdminAccessState(
      buildLink({ platform_api_base_url: "https://remote-runtime.example.com" }),
      {
        customerJourneysPlatformApiBaseUrl: "https://fallback-runtime.example.com",
        customerJourneysPlatformApiBaseUrlOverride: "http://127.0.0.1:4001/",
        customerJourneysInternalApiToken: "internal-token",
      },
    );

    expect(state.status).toBe("ready");
    expect(state.baseUrl).toBe("http://127.0.0.1:4001");
  });
});
