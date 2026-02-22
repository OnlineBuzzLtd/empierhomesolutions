import type { LpContent } from "@/modules/lp/types";
import { businessDetails } from "@/lib/business";

export function buildLocalBusinessJsonLd(content: LpContent, phoneNumber: string) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Empire Home Solutions",
    telephone: phoneNumber,
    areaServed: [content.locationLabel, ...content.coverage.postcodes],
    description: content.seo.description,
    serviceType: content.serviceLabel,
    sameAs: Object.values(businessDetails.socials),
    vatID: `GB${businessDetails.vatRegistrationNumber}`,
    identifier: [
      {
        "@type": "PropertyValue",
        propertyID: "GasSafe",
        value: businessDetails.gasSafeNumber,
      },
    ],
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
