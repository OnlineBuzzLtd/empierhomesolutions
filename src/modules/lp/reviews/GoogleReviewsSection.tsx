"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Star } from "lucide-react";
import { useGoogleReviews } from "@/modules/lp/reviews/GoogleReviewsProvider";
import type { GoogleReviewCard } from "@/modules/lp/reviews/types";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={17}
          aria-hidden="true"
          className={index < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review, active, position, count }: {
  review: GoogleReviewCard;
  active: boolean;
  position: number;
  count: number;
}) {
  const author = review.authorUri ? (
    <a
      href={review.authorUri}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={active ? 0 : -1}
      className="font-semibold text-[var(--ehs-brand-dark)] hover:underline"
    >
      {review.authorName}
    </a>
  ) : (
    <span className="font-semibold text-[var(--ehs-brand-dark)]">{review.authorName}</span>
  );

  return (
    <article
      className="min-w-full px-1"
      role="group"
      aria-roledescription="slide"
      aria-label={`${position} of ${count}: Review by ${review.authorName}`}
      aria-hidden={!active}
    >
      <div className="mx-auto flex min-h-64 max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--ehs-card-shadow)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {review.authorPhotoUri ? (
              // Google supplies this URL as part of the required review-author attribution.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={review.authorPhotoUri}
                alt=""
                width={40}
                height={40}
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                {review.authorName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              {author}
              <p className="mt-1 text-xs text-slate-500">
                {review.relativePublishTime ?? "Google review"}
              </p>
            </div>
          </div>
          <Stars rating={review.rating} />
        </div>
        <blockquote className="mt-5 flex-1 text-base leading-7 text-slate-700">
          “{review.text}”
        </blockquote>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
          <a
            href={review.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={active ? 0 : -1}
            className="inline-flex items-center gap-1 text-[var(--ehs-brand-accent)] hover:underline"
          >
            Read this review on Google Maps <ExternalLink size={13} aria-hidden="true" />
          </a>
          {review.flagContentUri ? (
            <a
              href={review.flagContentUri}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={active ? 0 : -1}
              className="text-slate-500 hover:underline"
            >
              Report review
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function GoogleReviewsSection() {
  const { enabled, loading, data } = useGoogleReviews();
  const [activeIndexState, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = data.reviews.length;
  const activeIndex = count > 0 ? activeIndexState % count : 0;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || count < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % count);
    }, 6_000);
    return () => window.clearInterval(timer);
  }, [count, paused, reducedMotion]);

  if (!enabled) return null;

  return (
    <section
      className="border-y border-slate-200 bg-[var(--ehs-surface-contrast)] px-4 py-12"
      aria-labelledby="google-reviews-heading"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ehs-brand-accent)]">
              Customer feedback
            </p>
            <h2 id="google-reviews-heading" className="mt-1 text-3xl font-semibold text-[var(--ehs-brand-dark)]">
              Google Reviews
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <Stars rating={data.rating} />
              <span className="font-semibold">{data.rating.toFixed(1)} from {data.reviewCount} reviews</span>
              {loading ? <span className="text-slate-500">Updating…</span> : null}
            </div>
          </div>
          <a
            href={data.reviewsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ehs-brand-dark)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Read all reviews <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>

        {count > 0 ? (
          <div
            className="mt-7"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
            }}
            aria-roledescription="carousel"
            aria-label="Google customer reviews"
          >
            <div className="overflow-hidden">
              <div
                className={reducedMotion ? "flex" : "flex transition-transform duration-500 ease-out"}
                style={{ transform: `translateX(-${activeIndex * 100}%)` }}
              >
                {data.reviews.map((review, index) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    active={index === activeIndex}
                    position={index + 1}
                    count={count}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setActiveIndex((activeIndex - 1 + count) % count)}
                className="rounded-full border border-slate-300 bg-white p-2 text-[var(--ehs-brand-dark)] hover:bg-slate-50"
                aria-label="Previous review"
              >
                <ChevronLeft size={19} aria-hidden="true" />
              </button>
              <p className="min-w-20 text-center text-xs text-slate-600" aria-live="polite">
                Review {activeIndex + 1} of {count}
              </p>
              <button
                type="button"
                onClick={() => setActiveIndex((activeIndex + 1) % count)}
                className="rounded-full border border-slate-300 bg-white p-2 text-[var(--ehs-brand-dark)] hover:bg-slate-50"
                aria-label="Next review"
              >
                <ChevronRight size={19} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
            Visit Google Maps to read our latest customer reviews.
          </p>
        )}

        <p className="mt-5 text-center text-xs text-slate-500">
          Reviews shown are selected and ordered by Google for relevance. Source: Google Maps.
        </p>
      </div>
    </section>
  );
}
