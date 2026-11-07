import { beforeEach, describe, expect, it, vi } from "vitest";
const runtime = vi.fn();
const link = vi.fn().mockResolvedValue({ customerjourneys_tenant_id: "fixture" });
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://empirehomesolutions.co.uk";
  process.env.NEXT_PUBLIC_CALL_NUMBER = "01895725151";
  vi.resetModules();
  vi.clearAllMocks();
  vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
    answerCustomerJourneysEducation: runtime,
    getCustomerJourneysRuntimeLink: link,
  }));
  vi.doMock("@/modules/crm/lib/supabase-server", () => ({ createCrmServiceRoleClient: () => ({}) }));
  vi.doMock("@/lib/origin", () => ({ validateRequestOrigin: () => ({ ok: true }) }));
  vi.doMock("@/lib/rate-limit", () => ({
    consumeRateLimit: async () => ({ ok: true }),
    rateLimitHeaders: () => ({}),
  }));
});
const request = (payload: unknown) =>
  new Request("https://empirehomesolutions.co.uk/api/public/webchat/education", {
    method: "POST",
    body: JSON.stringify(payload),
  });
describe("website educational proxy", () => {
  it("accepts questions without identity and fixes tenant selection server-side", async () => {
    runtime.mockResolvedValue({ mode: "education", answer: "Approved fact", sources: [] });
    const { POST } = await import("@/app/api/public/webchat/education/route");
    const response = await POST(request({ message: "What is a power flush?" }));
    expect(response.status).toBe(200);
    expect(link).toHaveBeenCalledWith({}, "11111111-1111-4111-8111-111111111111");
    expect(runtime).toHaveBeenCalledWith(expect.anything(), {
      message: "What is a power flush?",
      history: [],
    });
  });
  it("rejects legacy session IDs and client-controlled tenant or contact fields", async () => {
    const { POST } = await import("@/app/api/public/webchat/education/route");
    for (const field of ["conversationId", "tenantId", "email", "phone"]) {
      expect((await POST(request({ message: "Hello", [field]: "forged" }))).status).toBe(400);
    }
    expect(runtime).not.toHaveBeenCalled();
  });
  it("returns a form link on service failure without using any legacy runtime", async () => {
    runtime.mockRejectedValue(new Error("offline"));
    const { POST } = await import("@/app/api/public/webchat/education/route");
    const response = await POST(request({ message: "Book me tomorrow" }));
    expect(response.status).toBe(503);
    expect((await response.json()).enquiryUrl).toContain("#lead-form");
  });
});
describe("old Empire website sessions are retired before side effects", () => {
  it.each(["sessions", "messages", "close"])("blocks %s even with a forged tenant header", async (name) => {
    const route =
      name === "sessions"
        ? await import("@/app/api/public/webchat/sessions/route")
        : name === "messages"
          ? await import("@/app/api/public/webchat/messages/route")
          : await import("@/app/api/public/webchat/close/route");
    const response = await route.POST(
      new Request(`https://empirehomesolutions.co.uk/api/public/webchat/${name}`, {
        method: "POST",
        headers: { "x-tenant-slug": "another-tenant" },
        body: JSON.stringify({
          conversationId: "old",
          openingMessage: "Book tomorrow",
          body: "Confirm booking",
        }),
      }),
    );
    expect(response.status).toBe(410);
    expect((await response.json()).error.code).toBe("education_only");
    expect(link).not.toHaveBeenCalled();
    expect(runtime).not.toHaveBeenCalled();
  });
});
