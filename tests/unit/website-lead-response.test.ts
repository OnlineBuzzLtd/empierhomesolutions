import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ submit: vi.fn(), headers: new Headers({ origin: "https://empirehomesolutions.co.uk" }) }));
vi.mock("next/headers", () => ({ headers: async () => h.headers }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ conversionApiSecret: "test-secret" }), publicEnv: { siteUrl: "https://empirehomesolutions.co.uk" } }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: async () => ({ ok: true }), rateLimitHeaders: () => ({}) }));
vi.mock("@/lib/origin", () => ({ validateRequestOrigin: () => ({ ok: true, origin: "https://empirehomesolutions.co.uk" }) }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: async () => ({ ok: true }) }));
vi.mock("@/modules/forms/api/submitLead", () => ({ leadRequestSchema: { safeParse: (data: unknown) => ({ success: true, data }) }, submitLeadToWebhook: h.submit }));
import { POST } from "@/app/api/lead/route";
const request = () => new Request("https://empirehomesolutions.co.uk/api/lead", { method: "POST", body: JSON.stringify({ leadType: "repair" }) });
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}"))); });
describe("CRM success to browser conversion contract", () => {
  it("returns the stable event ID only after CRM success", async () => {
    const id = `ehs_lead_${"a".repeat(64)}`;
    h.submit.mockResolvedValue({ ok: true, conversionEventId: id });
    const response = await POST(request());
    expect(await response.json()).toEqual({ ok: true, conversionEventId: id });
  });
  it("does not return a conversion ID or run conversion hooks after CRM failure", async () => {
    h.submit.mockResolvedValue({ ok: false, status: 503, error: { code: "lead_create_failed", message: "Try again" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("conversionEventId");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not invent a conversion ID for the unverified webhook fallback", async () => {
    h.submit.mockResolvedValue({ ok: true });
    expect(await (await POST(request())).json()).toEqual({ ok: true });
  });
});
