import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { businessDetails } from "@/lib/business";
import { publicEnv } from "@/lib/env";
import { GoogleReviewsSection } from "@/modules/lp/reviews/GoogleReviewsSection";
import { OfferPriceCard } from "@/modules/offers/OfferPriceCard";
import { OfferContactBand, ServiceIncludesSection } from "@/modules/offers/OfferSections";
import { offers } from "@/modules/offers/offers";
import { Section } from "@/modules/ui/Section";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Heating Offers | Empire Home Solutions",
  description:
    "Boiler repairs from £79 + VAT, a full boiler service for £79 + VAT and limited-time power flush savings from Gas Safe engineers.",
  alternates: { canonical: `${publicEnv.siteUrl}/offers` },
};

const benefits = ["Lower energy bills", "A warmer home", "Reduced emissions", "Manufacturer warranties", "Local family business"];

export default function OffersPage() {
  const now = new Date();

  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="grid items-stretch lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4 bg-[var(--ehs-panel)] p-5 sm:p-8 md:p-10">
            <p className="inline-flex rounded-full border border-[var(--ehs-brand-accent)]/40 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--ehs-brand-dark)]">
              Trusted heating solutions
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--ehs-brand-dark-strong)] md:text-5xl">
              Our heating offers
            </h1>
            <p className="max-w-xl text-[15px] text-slate-700 md:text-lg">
              Experienced Gas Safe engineers who get it right first time. Clear, upfront pricing with no hidden charges.
            </p>
            <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 md:text-base">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2">
                  <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
                  {benefit}
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium text-[var(--ehs-brand-dark)]">
              Gas Safe {businessDetails.gasSafeNumber} | {businessDetails.emergencyHours}
            </p>
          </div>
          <div className="relative min-h-[240px] sm:min-h-[320px]">
            <Image
              src="/images/main-hero-2026-02-25.jpg"
              alt="Empire Home Solutions heating engineer"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              priority
              className="object-cover"
            />
          </div>
        </div>
        <div className="h-5 w-full bg-[var(--ehs-brand-accent)] [clip-path:polygon(0_35%,100%_0,100%_100%,0_100%)]" />
      </section>

      <Section title="Choose your offer" subtitle="Prices are shown plus VAT with the including-VAT total alongside.">
        <div className="grid gap-4 md:grid-cols-3">
          {offers.map((offer) => (
            <OfferPriceCard key={offer.slug} offer={offer} now={now} href={`/offers/${offer.slug}`} />
          ))}
        </div>
      </Section>

      <ServiceIncludesSection />
      <GoogleReviewsSection />
      <OfferContactBand />
    </>
  );
}
