import { beforeEach, describe, expect, it, vi } from "vitest";

const liveData = {
  live: true,
  rating: 4.9,
  reviewCount: 127,
  googleMapsUri: "https://maps.google.com/?cid=123",
  reviewsUri: "https://maps.google.com/reviews?cid=123",
  reviews: [],
};

async function loadRoute(fetchReviews: ReturnType<typeof vi.fn>) {
  vi.doMock("next/headers", () => ({
    headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    consumeRateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 19 }),
    rateLimitHeaders: () => ({ "X-RateLimit-Remaining": "19" }),
  }));
  vi.doMock("@/modules/lp/abFlags", () => ({
    getAbFlags: () => ({ reviews: "on" }),
  }));
  vi.doMock("@/lib/env", () => ({
    getServerEnv: () => ({
      googlePlacesApiKey: "server-secret-key",
      googlePlaceId: "verified-place-id",
    }),
  }));
  vi.doMock("@/modules/lp/reviews/google-places", () => ({
    fetchGooglePlaceReviews: fetchReviews,
  }));
  return import("@/app/api/public/google-reviews/route");
}

describe("GET /api/public/google-reviews", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("returns validated live data with no-store headers and no API-key leakage", async () => {
    const route = await loadRoute(vi.fn().mockResolvedValue(liveData));
    const response = await route.GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("19");
    expect(JSON.parse(text)).toEqual(liveData);
    expect(text).not.toContain("server-secret-key");
  });

  it("falls back cleanly when Google rejects the request", async () => {
    const route = await loadRoute(vi.fn().mockRejectedValue(new Error("upstream unavailable")));
    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.live).toBe(false);
    expect(body.reviews).toEqual([]);
  });

  it("aborts after five seconds and returns the fallback", async () => {
    vi.useFakeTimers();
    const fetchReviews = vi.fn(({ signal }: { signal: AbortSignal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const route = await loadRoute(fetchReviews);

    const pending = route.GET();
    await vi.advanceTimersByTimeAsync(5_000);
    const response = await pending;
    const body = await response.json();

    expect(fetchReviews).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "server-secret-key",
      placeId: "verified-place-id",
      signal: expect.any(AbortSignal),
    }));
    expect(body.live).toBe(false);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
