export type GoogleReviewCard = {
  id: string;
  authorName: string;
  authorUri: string | null;
  authorPhotoUri: string | null;
  rating: number;
  relativePublishTime: string | null;
  publishTime: string | null;
  text: string;
  googleMapsUri: string;
  flagContentUri: string | null;
};

export type GoogleReviewsData = {
  live: boolean;
  rating: number;
  reviewCount: number;
  googleMapsUri: string;
  reviewsUri: string;
  reviews: GoogleReviewCard[];
};
