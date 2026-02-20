import { describe, expect, it } from "vitest";
import {
  buildAttributionCookie,
  getAttributionFromCookieString,
  parseAttributionFromSearchParams,
  parseSerializedAttribution,
  serializeAttribution,
} from "@/modules/tracking/attribution";

describe("attribution", () => {
  it("parses UTM and click IDs from search params", () => {
    const params = new URLSearchParams("utm_source=google&utm_medium=cpc&utm_campaign=repair-ux&gclid=123");
    const parsed = parseAttributionFromSearchParams(params, "https://example.com/lp");

    expect(parsed.utm_source).toBe("google");
    expect(parsed.utm_medium).toBe("cpc");
    expect(parsed.utm_campaign).toBe("repair-ux");
    expect(parsed.gclid).toBe("123");
    expect(parsed.landing_url).toBe("https://example.com/lp");
  });

  it("serializes and parses attribution safely", () => {
    const attribution = { utm_source: "google", utm_campaign: "repair-campaign" };
    const serialized = serializeAttribution(attribution);
    const parsed = parseSerializedAttribution(serialized);

    expect(parsed).toEqual(attribution);
  });

  it("builds a cookie and reads it back", () => {
    const cookie = buildAttributionCookie({ utm_source: "google" });
    const extracted = getAttributionFromCookieString(cookie);

    expect(extracted?.utm_source).toBe("google");
  });
});
