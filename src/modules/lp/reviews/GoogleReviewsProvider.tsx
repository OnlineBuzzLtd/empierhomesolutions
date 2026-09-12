"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getGoogleReviewsFallback } from "@/modules/lp/reviews/fallback";
import type { GoogleReviewsData } from "@/modules/lp/reviews/types";

type GoogleReviewsContextValue = {
  enabled: boolean;
  loading: boolean;
  data: GoogleReviewsData;
};

const fallback = getGoogleReviewsFallback();
const GoogleReviewsContext = createContext<GoogleReviewsContextValue>({
  enabled: false,
  loading: false,
  data: fallback,
});

function isReviewsData(value: unknown): value is GoogleReviewsData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<GoogleReviewsData>;
  return typeof data.live === "boolean"
    && typeof data.rating === "number"
    && Number.isFinite(data.rating)
    && typeof data.reviewCount === "number"
    && typeof data.googleMapsUri === "string"
    && typeof data.reviewsUri === "string"
    && Array.isArray(data.reviews);
}

export function GoogleReviewsProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [data, setData] = useState<GoogleReviewsData>(fallback);
  const [loading, setLoading] = useState(enabled);
  const requestSequence = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const controller = new AbortController();

    void fetch("/api/public/google-reviews", {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Reviews request failed.");
        const value: unknown = await response.json();
        if (!isReviewsData(value)) throw new Error("Reviews response was invalid.");
        if (requestSequence.current === sequence) {
          setData({ ...value, reviews: value.reviews.slice(0, 5) });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (requestSequence.current === sequence) setData(fallback);
      })
      .finally(() => {
        if (requestSequence.current === sequence) setLoading(false);
      });

    return () => {
      requestSequence.current += 1;
      controller.abort();
    };
  }, [enabled]);

  const value = useMemo(() => ({ enabled, loading, data }), [data, enabled, loading]);
  return <GoogleReviewsContext.Provider value={value}>{children}</GoogleReviewsContext.Provider>;
}

export function useGoogleReviews() {
  return useContext(GoogleReviewsContext);
}
