import type { LpContent } from "@/modules/lp/types";

export function buildLocalBusinessJsonLd(content: LpContent, phoneNumber: string) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Empire Home Solutions",
    telephone: phoneNumber,
    areaServed: [content.locationLabel, ...content.coverage.postcodes],
    description: content.seo.description,
    serviceType: content.serviceLabel,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: content.trust.ratingValue,
      reviewCount: content.trust.ratingCount,
    },
    address: {
      "@type": "PostalAddress",
      addressRegion: content.seo.addressRegion,
      addressCountry: "GB",
    },
  };
}
