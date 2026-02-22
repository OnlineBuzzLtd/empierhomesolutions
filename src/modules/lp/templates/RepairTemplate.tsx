import dynamic from "next/dynamic";
import { businessDetails } from "@/lib/business";
import type { LpContent } from "@/modules/lp/types";
import { CoverageSection } from "@/modules/lp/components/CoverageSection";
import { FaultListSection } from "@/modules/lp/components/FaultListSection";
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

type RepairTemplateProps = {
  content: LpContent;
  trustOrder?: "default" | "rating-first";
};

export function RepairTemplate({ content, trustOrder }: RepairTemplateProps) {
  const heroProofLine = `Gas Safe ${content.trust.gasSafeNumber} | ${content.trust.ratingValue.toFixed(1)} (${content.trust.ratingCount} reviews) | ${businessDetails.emergencyHours}`;
  const leadType = content.service === "power-flushing" ? "power-flush" : "repair";
  const heading = content.service === "power-flushing" ? "Book your power flushing visit" : undefined;
  const pricingLabels =
    content.service === "power-flushing"
      ? {
          diagnostic: "System check from",
          repair: "Typical power flush range",
          install: "Filter and inhibitor add-ons",
        }
      : undefined;

  return (
    <>
      <HeroSection hero={content.hero} cta={content.cta} proofLine={heroProofLine} />
      <TrustStrip
        trust={content.trust}
        trustOrder={trustOrder}
        showFinance={false}
        diagnosticFrom={content.pricing.diagnosticFrom}
      />
      <FaultListSection faults={content.faults} />
      <PricingSection pricing={content.pricing} labels={pricingLabels} />
      <ProofCardsSection cards={content.proofCards} />
      <CoverageSection coverage={content.coverage} />
      <FaqSection faqs={content.faqs} />
      <QuoteForm service={content.service} location={content.locationLabel} leadType={leadType} heading={heading} />
    </>
  );
}
