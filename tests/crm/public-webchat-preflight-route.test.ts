import { beforeEach, describe, expect, it, vi } from "vitest";

const createSession = vi.fn();

async function loadRoute() {
  vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
    createCustomerJourneysWebchatSession: createSession,
    getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({
      customerjourneys_tenant_id: "cj-tenant-1",
      platform_api_base_url: "https://platform.example",
      auth_mode: "internal_service",
    }),
  }));
  vi.doMock("@/modules/crm/lib/env", () => ({
    getCrmEnv: () => ({ crmE2ePlatformFixturesEnabled: true }),
  }));
  vi.doMock("@/modules/crm/lib/supabase-server", () => ({
    createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
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
  vi.doMock("@/modules/lp/abFlags", () => ({
    getAbFlags: () => ({ webchatPreflight: "on" }),
  }));
  return import("@/app/api/public/webchat/sessions/route");
}

function request(payload: Record<string, unknown>) {
  return new Request("http://localhost/api/public/webchat/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("public webchat preflight route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    createSession.mockResolvedValue({ conversation: { id: "conversation-1" } });
  });

  it("requires name, mobile, email, and the customer's opening question", async () => {
    const route = await loadRoute();
    const response = await route.POST(request({
      visitorId: "visitor_12345678",
      openingMessage: "Boiler repair please",
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "contact_details_required" },
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("forwards normalised phone/contact identity and preserves the real first message", async () => {
    const route = await loadRoute();
    const response = await route.POST(request({
      visitorId: "visitor_12345678",
      fullName: "  Jane Smith  ",
      phone: "07911 123 456",
      email: " JANE@EXAMPLE.COM ",
      openingMessage: "  Can I book a boiler repair next Tuesday afternoon?  ",
      pagePath: "/lp/boiler-repair/uxbridge",
    }));

    expect(response.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith(expect.anything(), {
      identifierValue: "visitor_12345678",
      fullName: "Jane Smith",
      phoneNumber: "+447911123456",
      email: "jane@example.com",
      openingMessage: "Can I book a boiler repair next Tuesday afternoon?",
      startNewConversation: true,
      source: "empire_lp",
    });

    const logged = String((console.info as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ?? "");
    expect(logged).not.toContain("Jane Smith");
    expect(logged).not.toContain("jane@example.com");
    expect(logged).not.toContain("07911");
  });
});
