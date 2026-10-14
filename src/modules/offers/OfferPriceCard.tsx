import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Droplets, Flame, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  daysLeftToBook,
  formatBookBy,
  formatOfferPrice,
  offerView,
  type Offer,
  type OfferIcon,
} from "@/modules/offers/offers";

export const offerIcons: Record<OfferIcon, LucideIcon> = {
  wrench: Wrench,
  flame: Flame,
  droplets: Droplets,
};

export function daysLeftLabel(days: number) {
  return days === 1 ? "Last day to book" : `${days} days left to book`;
}

/** The headline price or discount for an offer, sized for light or dark backgrounds. */
export function OfferPrice({ offer, now, tone = "light" }: { offer: Offer; now: Date; tone?: "light" | "dark" }) {
  const { live } = offerView(offer, now);
  const bookBy = formatBookBy(offer);
  const price = offer.priceNet === undefined ? null : formatOfferPrice(offer.priceNet);
  const strong = tone === "dark" ? "text-white" : "text-[var(--ehs-brand-dark-strong)]";
  const muted = tone === "dark" ? "text-slate-300" : "text-slate-600";

  if (price) {
    return (
      <div>
        {offer.priceLead ? (
          <p className={cn("text-xs font-semibold uppercase tracking-wider", muted)}>{offer.priceLead}</p>
        ) : null}
        <p className={cn("text-4xl font-extrabold tracking-tight md:text-5xl", strong)}>{price.net}</p>
        <p className={cn("mt-1 text-sm", muted)}>{price.gross}</p>
      </div>
    );
  }

  if (live) {
    return (
      <div>
        <p className={cn("text-xs font-semibold uppercase tracking-wider", muted)}>Save</p>
        <p className={cn("text-4xl font-extrabold tracking-tight md:text-5xl", strong)}>{offer.discountLabel}</p>
        {offer.discountExtra ? <p className={cn("mt-1 text-base font-semibold", strong)}>{offer.discountExtra}</p> : null}
        {bookBy ? <p className={cn("mt-1 text-sm", muted)}>Book before {bookBy}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <p className={cn("text-2xl font-bold", strong)}>Fixed-price quote</p>
      <p className={cn("mt-1 text-sm", muted)}>This offer ended on {bookBy}. Call us for today&apos;s price.</p>
    </div>
  );
}

type OfferPriceCardProps = {
  offer: Offer;
  now: Date;
  /** When set, the card links through to the offer's own page. */
  href?: string;
};

export function OfferPriceCard({ offer, now, href }: OfferPriceCardProps) {
  const { live, priceNote } = offerView(offer, now);
  const days = live ? daysLeftToBook(offer, now) : null;
  const featured = days !== null;
  const Icon = offerIcons[offer.icon];

  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-white shadow-[var(--ehs-card-shadow)]",
        featured ? "border-[var(--ehs-brand-accent)] ring-2 ring-[var(--ehs-brand-accent)]" : "border-slate-200",
      )}
    >
      {featured ? (
        <p className="absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--ehs-brand-dark-strong)]">
          <Clock3 size={13} aria-hidden />
          Limited time
        </p>
      ) : null}

      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ehs-brand-dark)] text-white">
          <Icon size={22} aria-hidden />
        </span>
        <div>
          <h3 className="text-lg font-bold text-[var(--ehs-brand-dark)]">{offer.title}</h3>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{offer.tagline}</p>
        </div>
      </div>

      <div className="mx-5 rounded-xl bg-[var(--ehs-panel)] px-4 py-4">
        <OfferPrice offer={offer} now={now} />
        {days !== null ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--ehs-brand-dark)] px-3 py-1 text-xs font-semibold text-white">
            <Clock3 size={13} aria-hidden />
            {daysLeftLabel(days)}
          </p>
        ) : null}
      </div>

      <ul className="flex-1 space-y-2.5 px-5 py-5 text-sm text-slate-700">
        {offer.included.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <footer className="px-5 pb-5">
        <p className="text-sm font-medium text-slate-600">{priceNote}</p>
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className={cn(
              "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90",
              featured ? "bg-[var(--ehs-brand-accent)]" : "bg-[var(--ehs-brand-dark)]",
            )}
          >
            {live ? "Claim this offer" : "Find out more"}
            <ArrowRight size={16} aria-hidden />
          </Link>
        ) : null}
      </footer>
    </article>
  );
}
