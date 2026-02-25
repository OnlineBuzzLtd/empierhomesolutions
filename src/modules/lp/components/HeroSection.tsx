"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, PhoneCall } from "lucide-react";
import type { CTAContent, HeroContent } from "@/modules/lp/types";
import {
  getAttribution,
  hasAttributionData,
  parseAttributionFromSearchParams,
  persistAttribution,
} from "@/modules/tracking/attribution";
import { resolveCallNumber, toTelHref } from "@/modules/tracking/callNumber";
import { trackCallClick } from "@/modules/tracking/pushDataLayer";

type HeroSectionProps = {
  hero: HeroContent;
  cta: CTAContent;
  proofLine?: string;
};

export function HeroSection({ hero, cta, proofLine }: HeroSectionProps) {
  const searchParams = useSearchParams();
  const primaryLabel = cta.callLabel?.trim() || "Call Now";

  const callNumber = useMemo(() => {
    const queryAttribution = parseAttributionFromSearchParams(
      searchParams,
      typeof window === "undefined" ? undefined : window.location.href,
    );

    if (hasAttributionData(queryAttribution)) {
      return resolveCallNumber(queryAttribution);
    }

    return resolveCallNumber(getAttribution());
  }, [searchParams]);

  useEffect(() => {
    const queryAttribution = parseAttributionFromSearchParams(
      searchParams,
      typeof window === "undefined" ? undefined : window.location.href,
    );
    if (hasAttributionData(queryAttribution)) {
      persistAttribution(queryAttribution);
    }
  }, [searchParams]);

  const heroHighlights = [
    "Local engineer response with clear next steps",
    "Available 24/7, 365 days a year",
    "No hidden call-out charges",
    "Guaranteed workmanship from a Gas Safe team",
  ];

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="w-full px-0 py-0">
        <div className="overflow-hidden border-y border-slate-200 bg-white shadow-[var(--ehs-card-shadow)]">
          <div className="grid items-stretch gap-0 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-5 bg-[var(--ehs-panel)] p-4 sm:p-6 md:p-10">
              <p className="inline-flex rounded-full border border-[var(--ehs-brand-accent)]/40 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--ehs-brand-dark)]">
                {hero.eyebrow}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--ehs-brand-dark-strong)] md:text-6xl">
                {hero.headline}
              </h1>
              <p className="max-w-xl text-[15px] text-slate-700 md:text-xl">{hero.subline}</p>
              <ul className="space-y-2 text-sm text-slate-700 md:text-[17px]">
                {heroHighlights.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                <a
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:min-w-32 sm:w-auto sm:px-5 md:px-6 md:py-3.5 md:text-base"
                  href={toTelHref(callNumber)}
                  aria-label={primaryLabel}
                  style={{ color: "#ffffff" }}
                  onClick={() => trackCallClick("hero")}
                >
                  <PhoneCall size={16} />
                  {primaryLabel}
                </a>
                <Link
                  href="#lead-form"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--ehs-brand-dark)] bg-[var(--ehs-brand-dark)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:w-auto sm:px-5 md:px-6 md:py-3.5 md:text-base"
                >
                  {cta.quoteLabel}
                </Link>
              </div>
              {proofLine ? (
                <p className="flex w-full flex-wrap items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[var(--ehs-brand-dark)] sm:inline-flex sm:w-auto sm:text-sm">
                  {proofLine}
                </p>
              ) : null}
            </div>
            <div className="relative h-full min-h-[260px] sm:min-h-[320px] lg:min-h-[620px]">
              <Image
                src={hero.heroImage.src}
                alt={hero.heroImage.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 58vw"
                priority
                className="object-cover object-[52%_0%]"
              />
            </div>
          </div>
          <div className="h-5 w-full bg-[var(--ehs-brand-accent)] [clip-path:polygon(0_35%,100%_0,100%_100%,0_100%)]" />
        </div>
      </div>
    </section>
  );
}
