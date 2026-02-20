import dynamic from "next/dynamic";
import { businessDetails } from "@/lib/business";
import type { LpContent } from "@/modules/lp/types";
import { CoverageSection } from "@/modules/lp/components/CoverageSection";
import { HeroSection } from "@/modules/lp/components/HeroSection";
import { PricingSection } from "@/modules/lp/components/PricingSection";
import { TrustStrip } from "@/modules/lp/components/TrustStrip";

const FaqSection = dynamic(() =>
  import("@/modules/lp/components/FaqSection").then((module) => module.FaqSection),
);
const ProofCardsSection = dynamic(() =>
  import("@/modules/lp/components/ProofCardsSection").then((module) => module.ProofCardsSection),
);
const QuoteForm = dynamic(() =>
  import("@/modules/lp/components/QuoteForm").then((module) => module.QuoteForm),
);

type InstallTemplateProps = {
  content: LpContent;
  trustOrder?: "default" | "rating-first";
};

export function InstallTemplate({ content, trustOrder }: InstallTemplateProps) {
  const heroProofLine = `Gas Safe ${content.trust.gasSafeNumber} | ${content.trust.ratingValue.toFixed(1)} (${content.trust.ratingCount}+ reviews) | ${businessDetails.emergencyHours}`;

  return (
    <>
      <HeroSection hero={content.hero} cta={content.cta} proofLine={heroProofLine} />
      <TrustStrip trust={content.trust} trustOrder={trustOrder} />
      <PricingSection pricing={content.pricing} emphasizeFinance />
      <ProofCardsSection cards={content.proofCards} />
      <CoverageSection coverage={content.coverage} />
      <FaqSection faqs={content.faqs} />
      <QuoteForm
        service={content.service}
        location={content.locationLabel}
        leadType="install"
        heading="Book your installation survey"
      />
    </>
  );
}
