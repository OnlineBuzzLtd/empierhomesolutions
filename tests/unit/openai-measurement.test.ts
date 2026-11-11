// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  document.head.innerHTML = "";
  delete window.oaiq;
  for (const part of document.cookie.split(";")) document.cookie = `${part.split("=")[0].trim()}=; Max-Age=0; Path=/`;
  window.history.replaceState({}, "", "/");
});

describe("OpenAI measurement", () => {
  it("does not load the SDK or measure before consent", async () => {
    const pixel = await import("@/modules/tracking/openai-pixel");
    expect(pixel.initializeOpenAiPixel("test-pixel")).toBe(false);
    pixel.measureOpenAiPage();
    pixel.measureOpenAiLead(`ehs_lead_${"a".repeat(64)}`);
    expect(window.oaiq).toBeUndefined();
    expect(document.querySelector("script")).toBeNull();
  });

  it("queues documented events only after consent and uses the server event ID", async () => {
    const { setMeasurementConsent } = await import("@/modules/tracking/measurement-consent");
    const pixel = await import("@/modules/tracking/openai-pixel");
    setMeasurementConsent("granted");
    pixel.initializeOpenAiPixel("test-pixel", "test-nonce");
    pixel.measureOpenAiPage();
    const id = `ehs_lead_${"a".repeat(64)}`;
    pixel.measureOpenAiLead(id);
    pixel.measureOpenAiLead(id);
    pixel.measureOpenAiLead(undefined);
    const events = window.oaiq!.q!.filter((args) => args[0] === "measure");
    expect(events).toHaveLength(3);
    expect(events[0][1]).toBe("page_viewed");
    expect(events[1]).toEqual(["measure", "lead_created", { type: "customer_action" }, { event_id: id, opt_out: true }]);
    expect(events[2]).toEqual(events[1]); // Provider deduplicates retries by this stable ID.
    expect(document.querySelector("script")!.nonce).toBe("test-nonce");
  });

  it("revokes queued measurement, clears SDK cookies, and blocks future events", async () => {
    const { setMeasurementConsent } = await import("@/modules/tracking/measurement-consent");
    const pixel = await import("@/modules/tracking/openai-pixel");
    setMeasurementConsent("granted");
    pixel.initializeOpenAiPixel("test-pixel");
    pixel.measureOpenAiPage();
    document.cookie = "__oppref=opaque-ref; Path=/";
    document.cookie = "__obref=browser-ref; Path=/";
    setMeasurementConsent("denied");
    pixel.revokeOpenAiMeasurement();
    pixel.measureOpenAiLead(`ehs_lead_${"b".repeat(64)}`);
    expect(window.oaiq!.q!.filter((args) => args[0] === "measure")).toEqual([]);
    expect(window.oaiq!.q!.at(-1)).toEqual(["consent", false]);
    expect(document.cookie).not.toContain("__oppref");
    expect(document.cookie).not.toContain("__obref");
  });

  it("does not throw if the pixel fails after CRM success", async () => {
    const { setMeasurementConsent } = await import("@/modules/tracking/measurement-consent");
    const pixel = await import("@/modules/tracking/openai-pixel");
    setMeasurementConsent("granted");
    pixel.initializeOpenAiPixel("test-pixel");
    window.oaiq = () => { throw new Error("blocked"); };
    expect(() => pixel.measureOpenAiLead(`ehs_lead_${"c".repeat(64)}`)).not.toThrow();
  });
});

describe("attribution across pages", () => {
  it("keeps campaign attribution on an untagged internal page", async () => {
    const a = await import("@/modules/tracking/attribution");
    a.persistAttribution({ utm_source: "chatgpt", utm_campaign: "powerflush", landing_url: "https://example.com/?utm_source=chatgpt" });
    window.history.replaceState({}, "", "/offers/powerflush");
    expect(a.hasAttributionData(a.parseAttributionFromSearchParams(new URLSearchParams(), location.href))).toBe(false);
    expect(a.getAttribution().utm_source).toBe("chatgpt");
  });

  it("reads the latest campaign at submission time", async () => {
    const a = await import("@/modules/tracking/attribution");
    a.persistAttribution({ utm_source: "google" });
    window.history.replaceState({}, "", "/offers?utm_source=chatgpt");
    expect(a.getAttribution().utm_source).toBe("chatgpt");
  });

  it("preserves the exact OpenAI reference only with consent", async () => {
    const a = await import("@/modules/tracking/attribution");
    const { setMeasurementConsent } = await import("@/modules/tracking/measurement-consent");
    const opaque = "ref+/=value";
    document.cookie = `__oppref=${encodeURIComponent(opaque)}; Path=/`;
    expect(a.getAttribution().oppref).toBeUndefined();
    setMeasurementConsent("granted");
    expect(a.getAttribution().oppref).toBe(opaque);
    a.persistAttribution({ utm_source: "chatgpt", oppref: opaque });
    expect(sessionStorage.getItem("ehs_attribution")).not.toContain(opaque);
    setMeasurementConsent("denied");
    expect(a.getAttribution().oppref).toBeUndefined();
  });
});
