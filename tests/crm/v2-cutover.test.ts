import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleCrmV2Cutover } from "@/lib/crm-v2-cutover";
import { createHmac } from "node:crypto";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const req = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`https://old.example.test${path}`, init);
function enable() {
  vi.stubEnv("CRM_V2_ORIGIN", "https://new.example.test");
  vi.stubEnv("CRM_V2_LEGACY_ORIGINS", "https://old.example.test");
  vi.stubEnv("CRM_V2_QUOTES_ENABLED", "true");
  vi.stubEnv("CRM_V2_INGRESS_ENABLED", "true");
  vi.stubEnv("CRM_V2_FORWARDING_SECRET", "fixture-key");
}
describe("staged CRM cut-over", () => {
  it("leaves marketing and disabled routes alone", async () => {
    enable();
    expect(await handleCrmV2Cutover(req("/boiler-repair"))).toBeNull();
    vi.stubEnv("CRM_V2_QUOTES_ENABLED", "false");
    expect(await handleCrmV2Cutover(req("/q/token"))).toBeNull();
  });
  it("redirects public links and prevents stale quote editing and conversion", async () => {
    enable();
    for (const path of ["/q/token", "/quotes/uuid", "/booking/token"])
      expect((await handleCrmV2Cutover(req(path)))?.headers.get("location")).toBe(
        `https://new.example.test${path}`,
      );
    for (const path of ["/api/crm/quotes/id", "/api/crm/quotes/id/convert", "/api/crm/jobs/id/draft-quote"])
      expect((await handleCrmV2Cutover(req(path, { method: "POST" })))?.status).toBe(409);
  });
  it("forwards one signed request without changing its body or provider headers", async () => {
    enable();
    const fetcher = vi.fn(async () => new Response("accepted", { status: 202 }));
    vi.stubGlobal("fetch", fetcher);
    const response = await handleCrmV2Cutover(
      req("/api/webhooks/twilio/inbound", {
        method: "POST",
        body: "Body=STOP",
        headers: { "x-twilio-signature": "provider-proof" },
      }),
    );
    expect(response?.status).toBe(202);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.origin).toBe("https://new.example.test");
    expect(init.body).toBe("Body=STOP");
    const headers = new Headers(init.headers);
    expect(headers.get("x-twilio-signature")).toBe("provider-proof");
    const payload = `${headers.get("x-empire-forwarded-at")}.POST.https://old.example.test/api/webhooks/twilio/inbound.Body=STOP`;
    expect(headers.get("x-empire-forwarded-signature")).toBe(
      createHmac("sha256", "fixture-key").update(payload).digest("hex"),
    );
  });
  it("does not fall back to legacy after an ambiguous network failure", async () => {
    enable();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(
      (await handleCrmV2Cutover(req("/api/platform/events", { method: "POST", body: "{}" })))?.status,
    ).toBe(502);
  });
  it("does not move other tenant hosts", async () => {
    enable();
    expect(
      await handleCrmV2Cutover(new NextRequest("https://another-tenant.example.test/q/token")),
    ).toBeNull();
  });
});
