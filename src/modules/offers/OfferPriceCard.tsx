import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { formatBookBy, formatOfferPrice, offerView, type Offer } from "@/modules/offers/offers";

type OfferPriceCardProps = {
  offer: Offer;
  now: Date;
  /** When set, the card links through to the offer's own page. */
  href?: string;
};

export function OfferPriceCard({ offer, now, href }: OfferPriceCardProps) {
  const { live, priceNote } = offerView(offer, now);
  const bookBy = formatBookBy(offer);
  const price = offer.priceNet === undefined ? null : formatOfferPrice(offer.priceNet);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--ehs-card-shadow)]">
      <header className="bg-[var(--ehs-brand-dark)] px-5 py-4 text-white">
        <h3 className="text-xl font-bold uppercase tracking-wide">{offer.title}</h3>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--ehs-brand-accent-soft)]">
          {offer.tagline}
        </p>
      </header>

      <div className="border-b border-slate-200 bg-[var(--ehs-panel)] px-5 py-5">
        {price ? (
          <>
            {offer.priceLead ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{offer.priceLead}</p>
            ) : null}
            <p className="text-4xl font-extrabold tracking-tight text-[var(--ehs-brand-dark-strong)]">{price.net}</p>
            <p className="mt-1 text-sm text-slate-600">{price.gross}</p>
          </>
        ) : live ? (
          <>
            <p className="text-4xl font-extrabold tracking-tight text-[var(--ehs-brand-dark-strong)]">
              {offer.discountLabel}
            </p>
            {offer.discountExtra ? (
              <p className="mt-1 text-base font-semibold text-[var(--ehs-brand-dark)]">{offer.discountExtra}</p>
            ) : null}
            {bookBy ? (
              <p className="mt-3 inline-flex rounded-full bg-[var(--ehs-brand-accent)] px-3 py-1 text-xs font-semibold text-white">
                Book before {bookBy}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-[var(--ehs-brand-dark-strong)]">Fixed-price quote</p>
            <p className="mt-1 text-sm text-slate-600">This offer ended on {bookBy}. Call us for today&apos;s price.</p>
          </>
        )}
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
        <p className="text-sm font-semibold text-[var(--ehs-brand-dark)]">
          {priceNote}
        </p>
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            See offer details
            <ArrowRight size={16} aria-hidden />
          </Link>
        ) : null}
      </footer>
    </article>
  );
}
