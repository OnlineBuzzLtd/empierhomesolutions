import { aboutTrustContentSchema, financeContentSchema, lpContentSchema } from "@/modules/lp/content/schema";
import { defaultLpContent } from "@/modules/lp/content/defaults";
import { applyTokenReplacement } from "@/modules/lp/dtr";
import type { AboutTrustContent, FinanceContent, LpContent, ServiceSlug } from "@/modules/lp/types";

import aboutTrustRaw from "@/modules/lp/content/about-trust.json";
import financeRaw from "@/modules/lp/content/finance.json";
import hayesInstallRaw from "@/modules/lp/content/locations/hayes.boiler-installation.json";
import hayesPowerFlushingRaw from "@/modules/lp/content/locations/hayes.power-flushing.json";
import hayesRepairRaw from "@/modules/lp/content/locations/hayes.boiler-repair.json";
import uxbridgeInstallRaw from "@/modules/lp/content/locations/uxbridge.boiler-installation.json";
import uxbridgePowerFlushingRaw from "@/modules/lp/content/locations/uxbridge.power-flushing.json";
import uxbridgeRepairRaw from "@/modules/lp/content/locations/uxbridge.boiler-repair.json";

export const ALLOWED_SERVICES: ServiceSlug[] = ["boiler-repair", "boiler-installation", "power-flushing"];

const lpContentMap: Record<string, unknown> = {
  "boiler-repair/uxbridge": uxbridgeRepairRaw,
  "boiler-installation/uxbridge": uxbridgeInstallRaw,
  "power-flushing/uxbridge": uxbridgePowerFlushingRaw,
  "boiler-repair/hayes": hayesRepairRaw,
  "boiler-installation/hayes": hayesInstallRaw,
  "power-flushing/hayes": hayesPowerFlushingRaw,
};

const serviceLabelMap: Record<ServiceSlug, string> = {
  "boiler-repair": "Boiler Repair",
  "boiler-installation": "Boiler Installation",
  "power-flushing": "Power Flushing",
};

function mergeWithDefaults(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return defaultLpContent;
  }

  const partial = raw as Partial<typeof defaultLpContent>;

  return {
    ...defaultLpContent,
    ...partial,
    hero: {
      ...defaultLpContent.hero,
      ...(partial.hero ?? {}),
      heroImage: {
        ...defaultLpContent.hero.heroImage,
        ...(partial.hero?.heroImage ?? {}),
      },
    },
    trust: {
      ...defaultLpContent.trust,
      ...(partial.trust ?? {}),
    },
    pricing: {
      ...defaultLpContent.pricing,
      ...(partial.pricing ?? {}),
    },
    coverage: {
      ...defaultLpContent.coverage,
      ...(partial.coverage ?? {}),
    },
    cta: {
      ...defaultLpContent.cta,
      ...(partial.cta ?? {}),
    },
    seo: {
      ...defaultLpContent.seo,
      ...(partial.seo ?? {}),
    },
  };
}

export function normalizeLocationSlug(location: string) {
  return location
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isAllowedService(service: string): service is ServiceSlug {
  return ALLOWED_SERVICES.includes(service as ServiceSlug);
}

export function loadLpContent(params: {
  service: string;
  location: string;
  keyword?: string;
}): LpContent | null {
  if (!isAllowedService(params.service)) {
    return null;
  }

  const normalizedLocation = normalizeLocationSlug(params.location);
  const key = `${params.service}/${normalizedLocation}`;
  const rawContent = lpContentMap[key];

  if (!rawContent) {
    return null;
  }

  const parsed = lpContentSchema.safeParse(mergeWithDefaults(rawContent));
  if (!parsed.success) {
    return null;
  }

  const baseContent = {
    ...parsed.data,
    keyword: params.keyword?.trim() || parsed.data.keyword,
  };

  const tokenized = applyTokenReplacement(baseContent, {
    location: baseContent.locationLabel,
    service: serviceLabelMap[baseContent.service],
    keyword: baseContent.keyword,
  });

  return tokenized;
}

export function loadFinanceContent(): FinanceContent | null {
  const parsed = financeContentSchema.safeParse(financeRaw);
  return parsed.success ? parsed.data : null;
}

export function loadAboutTrustContent(): AboutTrustContent | null {
  const parsed = aboutTrustContentSchema.safeParse(aboutTrustRaw);
  return parsed.success ? parsed.data : null;
}
