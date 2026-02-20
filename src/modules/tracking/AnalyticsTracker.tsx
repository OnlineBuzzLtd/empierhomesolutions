"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { publicEnv } from "@/lib/env";
import {
  getAttribution,
  hasAttributionData,
  parseAttributionFromSearchParams,
  persistAttribution,
} from "@/modules/tracking/attribution";
import { pushDataLayer } from "@/modules/tracking/pushDataLayer";

function extractServiceLocation(pathname: string) {
  const match = pathname.match(/^\/lp\/([^/]+)\/([^/]+)/);
  return {
    service: match?.[1],
    location: match?.[2],
  };
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const landingUrl = `${window.location.origin}${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;
    const queryAttribution = parseAttributionFromSearchParams(searchParams, landingUrl);

    if (hasAttributionData(queryAttribution)) {
      persistAttribution(queryAttribution);
    }

    const attribution = getAttribution();
    const { service, location } = extractServiceLocation(pathname);

    pushDataLayer({
      event: "page_view",
      category: "page",
      action: pathname,
      label: service && location ? `${service}:${location}` : pathname,
    });

    if (!publicEnv.ga4Id || typeof window.gtag !== "function") {
      return;
    }

    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      service: service ?? undefined,
      location: location ?? undefined,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
    });
  }, [pathname, searchParams]);

  return null;
}
