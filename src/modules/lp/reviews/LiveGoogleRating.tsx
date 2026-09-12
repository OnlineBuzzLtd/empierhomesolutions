"use client";

import { useGoogleReviews } from "@/modules/lp/reviews/GoogleReviewsProvider";

export function LiveGoogleRating({
  fallbackRating,
  fallbackCount,
}: {
  fallbackRating: number;
  fallbackCount: number;
}) {
  const { enabled, data } = useGoogleReviews();
  const rating = enabled && data.live ? data.rating : fallbackRating;
  const reviewCount = enabled && data.live ? data.reviewCount : fallbackCount;

  return <>{rating.toFixed(1)} ({reviewCount} reviews)</>;
}
