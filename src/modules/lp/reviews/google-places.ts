import { z } from "zod";
import type { GoogleReviewCard, GoogleReviewsData } from "@/modules/lp/reviews/types";

export const GOOGLE_PLACES_FIELD_MASK = [
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
].join(",");

const httpsUrl = z.string().url().refine((value) => value.startsWith("https://"));

const reviewSchema = z.object({
  name: z.string().min(1),
  relativePublishTimeDescription: z.string().trim().min(1).optional(),
  text: z.object({ text: z.string().trim().min(1), languageCode: z.string().optional() }),
  rating: z.number().min(1).max(5),
  authorAttribution: z.object({
    displayName: z.string().trim().min(1),
    uri: httpsUrl.optional(),
    photoUri: httpsUrl.optional(),
  }),
  publishTime: z.string().datetime().optional(),
  googleMapsUri: httpsUrl,
  flagContentUri: httpsUrl.optional(),
});

const placeSchema = z.object({
  rating: z.number().min(0).max(5),
  userRatingCount: z.number().int().nonnegative(),
  googleMapsUri: httpsUrl,
  googleMapsLinks: z.object({ reviewsUri: httpsUrl }).optional(),
  reviews: z.array(z.unknown()).optional().default([]),
});

function normaliseReview(value: unknown): GoogleReviewCard | null {
  const parsed = reviewSchema.safeParse(value);
  if (!parsed.success) return null;

  const review = parsed.data;
  return {
    id: review.name,
    authorName: review.authorAttribution.displayName,
    authorUri: review.authorAttribution.uri ?? null,
    authorPhotoUri: review.authorAttribution.photoUri ?? null,
    rating: review.rating,
    relativePublishTime: review.relativePublishTimeDescription ?? null,
    publishTime: review.publishTime ?? null,
    text: review.text.text,
    googleMapsUri: review.googleMapsUri,
    flagContentUri: review.flagContentUri ?? null,
  };
}

export function normaliseGooglePlace(value: unknown): GoogleReviewsData {
  const place = placeSchema.parse(value);
  const reviews = place.reviews
    .map(normaliseReview)
    .filter((review): review is GoogleReviewCard => review !== null)
    .slice(0, 5);

  return {
    live: true,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    googleMapsUri: place.googleMapsUri,
    reviewsUri: place.googleMapsLinks?.reviewsUri ?? place.googleMapsUri,
    reviews,
  };
}

type FetchGooglePlaceReviewsOptions = {
  apiKey: string;
  placeId: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
};

export async function fetchGooglePlaceReviews({
  apiKey,
  placeId,
  signal,
  fetcher = fetch,
}: FetchGooglePlaceReviewsOptions): Promise<GoogleReviewsData> {
  const response = await fetcher(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
      },
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`Google Places request failed with status ${response.status}.`);
  }

  return normaliseGooglePlace(await response.json());
}
