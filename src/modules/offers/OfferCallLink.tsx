"use client";

import { useMemo, type ReactNode } from "react";
import { PhoneCall } from "lucide-react";
import { getAttribution, hasAttributionData, parseAttributionFromSearchParams } from "@/modules/tracking/attribution";
import { resolveCallNumber, toTelHref } from "@/modules/tracking/callNumber";
import { trackCallClick } from "@/modules/tracking/pushDataLayer";

type OfferCallLinkProps = {
  className?: string;
  /** Visible label; defaults to the resolved phone number. */
  children?: ReactNode;
};

/**
 * Call button using the attribution-aware tracking number, resolved the same
 * way as the sticky call bar. The layout's AnalyticsTracker persists attribution.
 */
export function OfferCallLink({ className, children }: OfferCallLinkProps) {
  const callNumber = useMemo(() => {
    if (typeof window === "undefined") {
      return resolveCallNumber();
    }
    const queryAttribution = parseAttributionFromSearchParams(
      new URLSearchParams(window.location.search),
      window.location.href,
    );
    return resolveCallNumber(hasAttributionData(queryAttribution) ? queryAttribution : getAttribution());
  }, []);

  return (
    <a href={toTelHref(callNumber)} className={className} onClick={() => trackCallClick("hero")}>
      <PhoneCall size={16} aria-hidden />
      {children ?? callNumber}
    </a>
  );
}
