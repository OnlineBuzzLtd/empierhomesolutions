import { describe, expect, it, vi } from "vitest";
import {
  fetchGooglePlaceReviews,
  GOOGLE_PLACES_FIELD_MASK,
  normaliseGooglePlace,
} from "@/modules/lp/reviews/google-places";

function review(index: number) {
  return {
    name: `places/review-${index}`,
    relativePublishTimeDescription: `${index} days ago`,
    text: { text: `Review ${index}`, languageCode: "en" },
    rating: 5,
    authorAttribution: {
      displayName: `Customer ${index}`,
      uri: `https://www.google.com/maps/contrib/${index}`,
      photoUri: `https://example.test/photo-${index}.jpg`,
    },
    publishTime: "2026-08-20T10:00:00.000Z",
    googleMapsUri: `https://www.google.com/maps/reviews/${index}`,
    flagContentUri: `https://www.google.com/maps/reviews/${index}/report`,
  };
}

function place(overrides: Record<string, unknown> = {}) {
  return {
    rating: 4.9,
    userRatingCount: 127,
    googleMapsUri: "https://maps.google.com/?cid=123",
    googleMapsLinks: { reviewsUri: "https://maps.google.com/reviews?cid=123" },
    reviews: [review(1), review(2)],
    ...overrides,
  };
}

describe("Google Places review validation", () => {
  it("returns at most five Google-ordered reviews", () => {
    const parsed = normaliseGooglePlace(place({
      reviews: Array.from({ length: 7 }, (_, index) => review(index + 1)),
    }));

    expect(parsed.live).toBe(true);
    expect(parsed.reviews).toHaveLength(5);
    expect(parsed.reviews.map((item) => item.authorName)).toEqual([
      "Customer 1",
      "Customer 2",
      "Customer 3",
      "Customer 4",
      "Customer 5",
    ]);
  });

  it("drops malformed review cards without rejecting a valid place", () => {
    const parsed = normaliseGooglePlace(place({
      reviews: [review(1), { ...review(2), googleMapsUri: "javascript:bad" }, null],
    }));

    expect(parsed.reviews).toHaveLength(1);
    expect(parsed.reviews[0]?.authorName).toBe("Customer 1");
  });

  it("rejects malformed aggregate data", () => {
    expect(() => normaliseGooglePlace(place({ rating: 9 }))).toThrow();
    expect(() => normaliseGooglePlace(place({ userRatingCount: -1 }))).toThrow();
  });
});

describe("Google Places request", () => {
  it("uses a strict field mask, no-store, and keeps the API key in a request header", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(place()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await fetchGooglePlaceReviews({
      apiKey: "server-secret-key",
      placeId: "verified-place-id",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit & { cache?: string }];
    expect(url).toBe("https://places.googleapis.com/v1/places/verified-place-id");
    expect(url).not.toContain("server-secret-key");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toMatchObject({
      "X-Goog-Api-Key": "server-secret-key",
      "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
    });
    expect(GOOGLE_PLACES_FIELD_MASK.split(",")).toEqual([
      "rating",
      "userRatingCount",
      "googleMapsUri",
      "googleMapsLinks.reviewsUri",
      "reviews.name",
      "reviews.relativePublishTimeDescription",
      "reviews.text",
      "reviews.rating",
      "reviews.authorAttribution",
      "reviews.publishTime",
      "reviews.googleMapsUri",
      "reviews.flagContentUri",
    ]);
  });

  it("surfaces upstream failures", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(fetchGooglePlaceReviews({
      apiKey: "server-secret-key",
      placeId: "verified-place-id",
      fetcher,
    })).rejects.toThrow(/503/);
  });
});
