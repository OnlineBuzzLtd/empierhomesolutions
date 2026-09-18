import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getAbFlags } from "@/modules/lp/abFlags";
import { getGoogleReviewsFallback } from "@/modules/lp/reviews/fallback";
import { fetchGooglePlaceReviews } from "@/modules/lp/reviews/google-places";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

function clientIp(headerStore: Awaited<ReturnType<typeof headers>>) {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? headerStore.get("x-real-ip")
    ?? "unknown";
}

function fallbackResponse(extraHeaders?: HeadersInit) {
  return NextResponse.json(getGoogleReviewsFallback(), {
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

export async function GET() {
  if (getAbFlags().reviews !== "on") return fallbackResponse();

  const headerStore = await headers();
  const decision = await consumeRateLimit(`public-google-reviews:${clientIp(headerStore)}`, {
    tokens: 20,
    window: "1 m",
    prefix: "rl:public-google-reviews",
  });
  if (!decision.ok) return fallbackResponse(rateLimitHeaders(decision));

  const env = getServerEnv();
  if (!env.googlePlacesApiKey || !env.googlePlaceId) {
    return fallbackResponse(rateLimitHeaders(decision));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const reviews = await fetchGooglePlaceReviews({
      apiKey: env.googlePlacesApiKey,
      placeId: env.googlePlaceId,
      signal: controller.signal,
    });
    return NextResponse.json(reviews, {
      headers: { ...NO_STORE_HEADERS, ...rateLimitHeaders(decision) },
    });
  } catch (error) {
    console.warn(JSON.stringify({
      event: "google_reviews_fetch_failed",
      error: error instanceof Error ? error.name : "unknown_error",
    }));
    return fallbackResponse(rateLimitHeaders(decision));
  } finally {
    clearTimeout(timeout);
  }
}
