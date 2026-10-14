import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { businessDetails } from "@/lib/business";
import { publicEnv } from "@/lib/env";
import { lpSocialImage } from "@/modules/lp/social-image";
import { FaqSection } from "@/modules/lp/components/FaqSection";
import { HeroSection } from "@/modules/lp/components/HeroSection";
import { QuoteForm } from "@/modules/lp/components/QuoteForm";
import { GoogleReviewsSection } from "@/modules/lp/reviews/GoogleReviewsSection";
import { LiveGoogleRating } from "@/modules/lp/reviews/LiveGoogleRating";
import { OfferPriceCard } from "@/modules/offers/OfferPriceCard";
import { OfferContactBand, ServiceIncludesSection } from "@/modules/offers/OfferSections";
import { getOffer, offers, offerView } from "@/modules/offers/offers";
import { Section } from "@/modules/ui/Section";

export const revalidate = 3600;

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return offers.map((offer) => ({ slug: offer.slug }));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const offer = getOffer((await params).slug);
  if (!offer) {
    return { title: "Page not found", robots: { index: false, follow: false } };
  }
  const { seo } = offerView(offer);
  const canonical = `${publicEnv.siteUrl}/offers/${offer.slug}`;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    openGraph: { title: seo.title, description: seo.description, url: canonical, type: "website", images: [lpSocialImage] },
  };
}

export default async function OfferPage({ params }: RouteProps) {
  const offer = getOffer((await params).slug);
  if (!offer) {
    notFound();
  }

  const now = new Date();
  const view = offerView(offer, now);
  const otherOffers = offers.filter((item) => item.slug !== offer.slug);

  return (
    <>
      <HeroSection
        hero={{
          ...view.hero,
          primaryCta: "Call Now",
          secondaryCta: "Book Now",
          responseTimeBadge: businessDetails.emergencyHours,
        }}
        cta={{ callLabel: "Call Now", quoteLabel: view.live ? "Claim this offer" : "Book Now" }}
        proofLine={
          <>
            Gas Safe {businessDetails.gasSafeNumber} |&nbsp;
            <LiveGoogleRating
              fallbackRating={businessDetails.googleRatingValue}
              fallbackCount={businessDetails.googleReviewCount}
            />
            &nbsp;| {businessDetails.emergencyHours}
          </>
        }
      />

      <Section title="What you get" subtitle="Prices are shown plus VAT with the including-VAT total alongside.">
        <div className="grid gap-6 md:grid-cols-[minmax(0,380px)_1fr] md:items-start">
          <OfferPriceCard offer={offer} now={now} />
          <div className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-[var(--ehs-card-shadow)] md:text-base">
            <p>{view.hero.subline}</p>
            <p className="mt-3">
              Every job is carried out by our own Gas Safe registered engineers. We confirm the price with you before
              any work starts, so there are no surprises.
            </p>
            <p className="mt-3 font-semibold text-[var(--ehs-brand-dark)]">
              Call {businessDetails.primaryPhoneDisplay} or send the form below and we will be in touch to book you in.
            </p>
          </div>
        </div>
      </Section>

      <ServiceIncludesSection />
      <GoogleReviewsSection />
      <FaqSection faqs={view.faqs} />
      <OfferContactBand />
      <QuoteForm
        service={offer.lead.service}
        leadType={offer.lead.leadType}
        heading={view.live ? "Claim this offer - request a callback" : undefined}
      />

      <Section title="More heating offers">
        <div className="grid gap-4 md:grid-cols-2">
          {otherOffers.map((item) => (
            <OfferPriceCard key={item.slug} offer={item} now={now} href={`/offers/${item.slug}`} />
          ))}
        </div>
        <p className="mt-6 text-sm">
          <Link href="/offers" prefetch={false} className="font-semibold text-[var(--ehs-brand-accent)] underline">
            See all our heating offers
          </Link>
        </p>
      </Section>
    </>
  );
}
