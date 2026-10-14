import type { Metadata } from "next";
import { publicEnv } from "@/lib/env";
import { GoogleReviewsSection } from "@/modules/lp/reviews/GoogleReviewsSection";
import { OffersHubHero } from "@/modules/offers/OfferHero";
import { OfferPriceCard } from "@/modules/offers/OfferPriceCard";
import { HowItWorksSection, OfferCtaBand, ServiceIncludesStrip } from "@/modules/offers/OfferSections";
import { offers } from "@/modules/offers/offers";
import { Section } from "@/modules/ui/Section";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Heating Offers | Empire Home Solutions",
  description:
    "Boiler repairs from £79 + VAT, a full boiler service for £79 + VAT and limited-time power flush savings from Gas Safe engineers.",
  alternates: { canonical: `${publicEnv.siteUrl}/offers` },
};

export default function OffersPage() {
  const now = new Date();

  return (
    <>
      <OffersHubHero now={now} />
      <ServiceIncludesStrip />
      <div id="offers" className="scroll-mt-32">
        <Section title="Choose your offer" subtitle="Prices are shown plus VAT with the including-VAT total alongside.">
          <div className="grid gap-6 pt-3 md:grid-cols-3">
            {offers.map((offer) => (
              <OfferPriceCard key={offer.slug} offer={offer} now={now} href={`/offers/${offer.slug}`} />
            ))}
          </div>
        </Section>
      </div>
      <HowItWorksSection />
      <GoogleReviewsSection />
      <OfferCtaBand title="Not sure which offer you need?" />
    </>
  );
}
