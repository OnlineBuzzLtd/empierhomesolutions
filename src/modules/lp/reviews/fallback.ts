import { businessDetails } from "@/lib/business";
import type { GoogleReviewsData } from "@/modules/lp/reviews/types";

export function getGoogleReviewsFallback(): GoogleReviewsData {
  return {
    live: false,
    rating: businessDetails.googleRatingValue,
    reviewCount: businessDetails.googleReviewCount,
    googleMapsUri: businessDetails.googleReviewUrl,
    reviewsUri: businessDetails.googleReviewUrl,
    reviews: [],
  };
}
