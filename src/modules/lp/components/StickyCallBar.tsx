"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle, PhoneCall } from "lucide-react";
import { businessDetails } from "@/lib/business";
import {
  getAttribution,
  hasAttributionData,
  parseAttributionFromSearchParams,
  persistAttribution,
} from "@/modules/tracking/attribution";
import { resolveCallNumber, toTelHref } from "@/modules/tracking/callNumber";
import { trackCallClick, trackWhatsappClick } from "@/modules/tracking/pushDataLayer";

export function StickyCallBar() {
  const searchParams = useSearchParams();

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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
        <a
          href={toTelHref(callNumber)}
          onClick={() => trackCallClick("sticky")}
          className="flex items-center justify-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-4 py-3 text-sm font-semibold text-white"
        >
          <PhoneCall size={16} />
          Call Now
        </a>
        <a
          href={businessDetails.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsappClick("sticky")}
          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--ehs-brand-dark)] bg-[var(--ehs-brand-dark)] px-4 py-3 text-sm font-semibold text-white"
        >
          <MessageCircle size={16} />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
