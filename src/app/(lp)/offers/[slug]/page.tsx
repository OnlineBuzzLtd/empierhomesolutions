import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { lpSocialImage } from "@/modules/lp/social-image";
import { FaqSection } from "@/modules/lp/components/FaqSection";
import { QuoteForm } from "@/modules/lp/components/QuoteForm";
import { GoogleReviewsSection } from "@/modules/lp/reviews/GoogleReviewsSection";
import { OfferCallLink } from "@/modules/offers/OfferCallLink";
import { OfferHero } from "@/modules/offers/OfferHero";
import { OfferPrice, offerIcons } from "@/modules/offers/OfferPriceCard";
import { HowItWorksSection, OfferCtaBand, ServiceIncludesStrip } from "@/modules/offers/OfferSections";
import { getOffer, offers, offerView, type Offer } from "@/modules/offers/offers";
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

function ReasonsSection({ offer }: { offer: Offer }) {
  return (
    <Section title={offer.reasons.title}>
      <div className="grid gap-4 md:grid-cols-3">
        {offer.reasons.items.map((reason) => (
          <article
            key={reason.title}
            className="rounded-2xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-5 shadow-[var(--ehs-card-shadow)]"
          >
            <h3 className="text-base font-bold text-[var(--ehs-brand-dark)]">{reason.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{reason.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

function ClaimSection({ offer, now }: { offer: Offer; now: Date }) {
  const view = offerView(offer, now);
  return (
    <section className="bg-[var(--ehs-panel)]">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 md:py-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <aside className="rounded-2xl bg-[var(--ehs-brand-dark)] p-6 text-white shadow-[var(--ehs-card-shadow)] lg:sticky lg:top-36">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--ehs-brand-accent-soft)]">
            {view.live ? "You are claiming" : "You are booking"}
          </p>
          <h2 className="mt-1 text-2xl font-bold">{offer.title}</h2>
          <div className="mt-4">
            <OfferPrice offer={offer} now={now} tone="dark" />
          </div>
          <hr className="my-5 border-white/15" />
          <p className="text-sm text-slate-200">
            Send the form and we will call you back to agree a time. Prefer to talk now?
          </p>
          <OfferCallLink className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[var(--ehs-brand-dark)] transition hover:opacity-90" />
        </aside>
        <QuoteForm
          className="max-w-none px-0 py-0 md:py-0"
          service={offer.lead.service}
          leadType={offer.lead.leadType}
          heading={view.live ? "Claim this offer" : "Request a callback"}
        />
      </div>
    </section>
  );
}

function MoreOffers({ current }: { current: Offer }) {
  return (
    <Section title="More heating offers">
      <div className="grid gap-4 md:grid-cols-2">
        {offers
          .filter((item) => item.slug !== current.slug)
          .map((item) => {
            const Icon = offerIcons[item.icon];
            return (
              <Link
                key={item.slug}
                href={`/offers/${item.slug}`}
                prefetch={false}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--ehs-card-shadow)] transition hover:border-[var(--ehs-brand-accent)]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--ehs-brand-dark)] text-white">
                  <Icon size={24} aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block text-base font-bold text-[var(--ehs-brand-dark)]">{item.title}</span>
                  <span className="block text-sm text-slate-600">{offerView(item).hero.headline}</span>
                </span>
                <ArrowRight
                  size={20}
                  aria-hidden
                  className="shrink-0 text-[var(--ehs-brand-accent)] transition group-hover:translate-x-1"
                />
              </Link>
            );
          })}
      </div>
    </Section>
  );
}

export default async function OfferPage({ params }: RouteProps) {
  const offer = getOffer((await params).slug);
  if (!offer) {
    notFound();
  }

  const now = new Date();
  const view = offerView(offer, now);

  return (
    <>
      <OfferHero offer={offer} now={now} />
      <ServiceIncludesStrip />
      <ReasonsSection offer={offer} />
      <HowItWorksSection />
      <GoogleReviewsSection />
      <ClaimSection offer={offer} now={now} />
      <FaqSection faqs={view.faqs} />
      <MoreOffers current={offer} />
      <OfferCtaBand />
    </>
  );
}
