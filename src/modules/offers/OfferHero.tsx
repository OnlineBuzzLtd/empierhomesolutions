import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, Clock3, ShieldCheck, Star } from "lucide-react";
import { businessDetails } from "@/lib/business";
import { LiveGoogleRating } from "@/modules/lp/reviews/LiveGoogleRating";
import { OfferCallLink } from "@/modules/offers/OfferCallLink";
import { daysLeftLabel, OfferPrice, offerIcons } from "@/modules/offers/OfferPriceCard";
import { daysLeftToBook, offers, offerView, type Offer } from "@/modules/offers/offers";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-6 py-3.5 text-base font-semibold text-white transition hover:opacity-90";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-base font-semibold text-[var(--ehs-brand-dark)] transition hover:opacity-90";

function TrustRow() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-200">
      <li className="inline-flex items-center gap-1.5">
        <ShieldCheck size={16} aria-hidden className="text-amber-400" />
        Gas Safe {businessDetails.gasSafeNumber}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Star size={16} aria-hidden className="fill-amber-400 text-amber-400" />
        <LiveGoogleRating
          fallbackRating={businessDetails.googleRatingValue}
          fallbackCount={businessDetails.googleReviewCount}
        />
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Clock3 size={16} aria-hidden className="text-amber-400" />
        {businessDetails.emergencyHours}
      </li>
    </ul>
  );
}

function SlantedEdge() {
  return <div className="h-5 w-full bg-[var(--ehs-brand-accent)] [clip-path:polygon(0_35%,100%_0,100%_100%,0_100%)]" />;
}

export function OfferHero({ offer, now }: { offer: Offer; now: Date }) {
  const view = offerView(offer, now);
  const days = view.live ? daysLeftToBook(offer, now) : null;
  const Icon = offerIcons[offer.icon];

  return (
    <section className="relative overflow-hidden bg-[var(--ehs-brand-dark)] text-white">
      <Icon aria-hidden className="pointer-events-none absolute -right-20 -top-16 h-[460px] w-[460px] text-white/[0.04]" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
        <div className="space-y-5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-300">
            <Link href="/offers" prefetch={false} className="hover:text-white">
              Offers
            </Link>
            <ChevronRight size={14} aria-hidden />
            <span className="text-white">{offer.title}</span>
          </nav>
          {days !== null ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--ehs-brand-dark-strong)]">
              <Clock3 size={13} aria-hidden />
              {view.hero.eyebrow} · {daysLeftLabel(days)}
            </p>
          ) : (
            <p className="inline-flex rounded-full border border-white/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--ehs-brand-accent-soft)]">
              {view.hero.eyebrow}
            </p>
          )}
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">{view.hero.headline}</h1>
          <p className="max-w-xl text-base text-slate-200 md:text-lg">{view.hero.subline}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href="#lead-form" className={primaryButton}>
              {view.live ? "Claim this offer" : "Request a callback"}
              <ArrowRight size={18} aria-hidden />
            </a>
            <OfferCallLink className={secondaryButton} />
          </div>
          <TrustRow />
        </div>

        <aside className="rounded-2xl bg-white p-6 text-slate-900 shadow-2xl md:p-7">
          <OfferPrice offer={offer} now={now} />
          <hr className="my-5 border-slate-200" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">What&apos;s included</p>
          <ul className="mt-3 space-y-2.5 text-[15px] text-slate-700">
            {offer.included.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 size={19} aria-hidden className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-lg bg-[var(--ehs-panel)] px-3 py-2 text-sm font-medium text-[var(--ehs-brand-dark)]">
            We confirm the price with you before any work starts.
          </p>
        </aside>
      </div>
      <SlantedEdge />
    </section>
  );
}

export function OffersHubHero({ now }: { now: Date }) {
  const flush = offers.find((offer) => offer.slug === "power-flush");
  const flushDays = flush && offerView(flush, now).live ? daysLeftToBook(flush, now) : null;

  return (
    <section className="relative overflow-hidden bg-[var(--ehs-brand-dark)] text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
        <div className="space-y-5">
          <p className="inline-flex rounded-full border border-white/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--ehs-brand-accent-soft)]">
            Trusted heating solutions
          </p>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Heating offers from <span className="text-amber-400">£79</span> + VAT
          </h1>
          <p className="max-w-xl text-base text-slate-200 md:text-lg">
            Boiler repairs, a full boiler service and power flushing from experienced Gas Safe engineers who get it
            right first time. Clear, upfront pricing with no hidden charges.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href="#offers" className={primaryButton}>
              See the offers
              <ArrowRight size={18} aria-hidden />
            </a>
            <OfferCallLink className={secondaryButton} />
          </div>
          <TrustRow />
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl lg:aspect-[4/5]">
            <Image
              src="/images/powerflush-shane.jpg"
              alt="Empire Home Solutions engineer with power flushing equipment"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              priority
              className="object-cover object-[50%_18%]"
            />
          </div>
          {flushDays !== null ? (
            <Link
              href="/offers/power-flush"
              prefetch={false}
              className="absolute -bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-xl bg-white p-4 text-[var(--ehs-brand-dark)] shadow-xl sm:left-6 sm:right-auto"
            >
              <span>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Limited time</span>
                <span className="block text-lg font-bold">£100 off a power flush</span>
                <span className="block text-sm text-slate-600">+ a free boiler service · {daysLeftLabel(flushDays)}</span>
              </span>
              <ArrowRight size={20} aria-hidden className="shrink-0 text-[var(--ehs-brand-accent)]" />
            </Link>
          ) : null}
        </div>
      </div>
      <div className="h-8 md:h-4" />
      <SlantedEdge />
    </section>
  );
}
