import type { Metadata } from "next";
import { publicEnv } from "@/lib/env";
import { GoogleReviewsSection } from "@/modules/lp/reviews/GoogleReviewsSection";
import { OffersHubHero } from "@/modules/offers/OfferHero";
import { OfferPriceCard } from "@/modules/offers/OfferPriceCard";
import { HowItWorksSection, OfferCtaBand, ServiceIncludesStrip } from "@/modules/offers/OfferSections";
import { offers } from "@/modules/offers/offers";
import { Section } from "@/modules/ui/Section";
import { BarkBadge } from "@/modules/lp/components/BarkBadge";
import { PhoenixFinanceSection } from "@/modules/lp/components/PhoenixFinanceBanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Heating Offers | Empire Home Solutions",
  description:
    "New boiler installed from £1,895 + VAT, plus boiler repairs from £79 + VAT and a full boiler service for £79 + VAT, from Gas Safe engineers.",
  alternates: { canonical: `${publicEnv.siteUrl}/offers` },
};

export default function OffersPage() {
  const now = new Date();

  return (
    <>
      <OffersHubHero />
      <ServiceIncludesStrip />
      <PhoenixFinanceSection />
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
      <section className="bg-white px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3">
          <p className="text-sm text-slate-700">Find us on Bark:</p>
          <BarkBadge />
        </div>
      </section>
      <OfferCtaBand title="Not sure which offer you need?" />
    </>
  );
}
