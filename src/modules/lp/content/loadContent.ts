import { businessDetails } from "@/lib/business";
import {
  aboutTrustContentSchema,
  financeContentSchema,
  lpContentSchema,
  questionsAndAnswersContentSchema,
} from "@/modules/lp/content/schema";
import { defaultLpContent } from "@/modules/lp/content/defaults";
import {
  getLocationEntry,
  normalizeLocationSlug,
  type LocationEntry,
} from "@/modules/lp/content/locationCatalog";
import { applyTokenReplacement } from "@/modules/lp/dtr";
import type {
  AboutTrustContent,
  FinanceContent,
  LpContent,
  QuestionsAndAnswersContent,
  ServiceSlug,
} from "@/modules/lp/types";

import aboutTrustRaw from "@/modules/lp/content/about-trust.json";
import financeRaw from "@/modules/lp/content/finance.json";
import questionsAndAnswersRaw from "@/modules/lp/content/q-and-a.json";
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

const powerFlushingFaults = [
  {
    id: "cold-spots",
    title: "Cold spots",
    description: "Radiators heat unevenly with cold areas at the bottom.",
    icon: "flame",
  },
  {
    id: "noisy-boiler",
    title: "Boiler noise",
    description: "Rumbling or kettling sounds from trapped sludge and poor flow.",
    icon: "bell",
  },
  {
    id: "slow-warmup",
    title: "Slow warm-up",
    description: "Heating takes too long to warm rooms even with thermostat on.",
    icon: "gauge",
  },
  {
    id: "frequent-bleeding",
    title: "Frequent bleeding",
    description: "Radiators repeatedly need bleeding and system balance drops.",
    icon: "droplets",
  },
  {
    id: "blocked-pipework",
    title: "Blocked pipework",
    description: "Circulation problems from debris in older systems.",
    icon: "wrench",
  },
  {
    id: "high-bills",
    title: "High bills",
    description: "Inefficient circulation can increase gas use and running costs.",
    icon: "triangle-alert",
  },
] as const;

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

function buildGeneratedLpContent(service: ServiceSlug, location: LocationEntry) {
  const locationSlug = normalizeLocationSlug(location.label);
  const base = {
    slug: `${locationSlug}-${service}`,
    service,
    serviceLabel: serviceLabelMap[service],
    locationLabel: location.label,
    cta: defaultLpContent.cta,
    coverage: {
      primaryTown: location.label,
      radiusMiles: 12,
      postcodes: [location.postcodeArea],
      regionsCovered: businessDetails.coverageRegions,
      outsideAreaNote: "Outside area? Call to confirm",
    },
    seo: {
      title: `${serviceLabelMap[service]} in ${location.label} | Empire Home Solutions`,
      description: "",
      addressRegion: location.label,
    },
  };

  if (service === "boiler-installation") {
    return {
      ...base,
      keyword: "new boiler installation",
      hero: {
        ...defaultLpContent.hero,
        headline: "Get {{service}} in {{location}} with flexible finance terms",
        subline: "Fixed-install quotes from trusted engineers, plus domestic power flushing support where needed.",
        heroImage: {
          ...defaultLpContent.hero.heroImage,
          alt: "Smiling engineer installing a modern boiler",
        },
      },
      trust: {
        ...defaultLpContent.trust,
        financeAvailable: true,
        guaranteeText: "Guaranteed for up to 10 years (selected ranges include 5 or 7 years)",
      },
      pricing: {
        diagnosticFrom: 0,
        repairRangeMin: 95,
        repairRangeMax: 450,
        installRangeMin: 1995,
        installRangeMax: 5000,
        pricingDisclaimer: "Install pricing varies by property size, flue route, controls, and boiler output.",
        financeExample: defaultLpContent.pricing.financeExample,
      },
      faults: [],
      proofCards: [
        {
          id: `${locationSlug}-i-1`,
          postcode: location.postcodeArea,
          serviceType: "Installation",
          outcome: "Combi upgrade completed",
          reviewSnippet: "Whole installation completed neatly with clear handover on controls.",
          date: "2026-01-12",
        },
        {
          id: `${locationSlug}-i-2`,
          postcode: location.postcodeArea,
          serviceType: "Installation",
          outcome: "Energy efficiency improved",
          reviewSnippet: "Great advice on boiler sizing, controls, and long-term running costs.",
          date: "2026-01-25",
        },
      ],
      faqs: [
        {
          id: `${locationSlug}-inst-1`,
          question: "How long does installation usually take?",
          answer: "Most standard combi swaps are completed within one working day.",
        },
        {
          id: `${locationSlug}-inst-2`,
          question: "Can I spread the cost of a new boiler?",
          answer: "Yes. Finance terms are available over 3, 5, 8, and 10 years, subject to status.",
        },
      ],
      seo: {
        ...base.seo,
        description:
          "Fixed-price boiler installation in {{location}} from Heating and Gas Engineers with warranties of up to 10 years.",
      },
    };
  }

  if (service === "power-flushing") {
    return {
      ...base,
      keyword: "power flushing near me",
      hero: {
        ...defaultLpContent.hero,
        headline: "Book {{service}} in {{location}}",
        subline: "Restore radiator performance, reduce boiler noise, and improve circulation with a full domestic system flush.",
        heroImage: {
          ...defaultLpContent.hero.heroImage,
          alt: "Engineer carrying out a domestic power flushing visit",
        },
      },
      trust: {
        ...defaultLpContent.trust,
        financeAvailable: false,
        guaranteeText: "Clear fixed quote before work starts",
      },
      pricing: {
        diagnosticFrom: 79,
        repairRangeMin: 350,
        repairRangeMax: 700,
        installRangeMin: 120,
        installRangeMax: 245,
        pricingDisclaimer:
          "Power flushing cost depends on radiator count, sludge level, and required inhibitor/filter top-up.",
      },
      faults: powerFlushingFaults,
      proofCards: [
        {
          id: `${locationSlug}-pf-1`,
          postcode: location.postcodeArea,
          serviceType: "Power Flushing",
          outcome: "Radiator circulation restored",
          reviewSnippet: "Cold spots were removed and the whole system heats up faster now.",
          date: "2026-01-16",
        },
        {
          id: `${locationSlug}-pf-2`,
          postcode: location.postcodeArea,
          serviceType: "Power Flushing",
          outcome: "Boiler noise reduced",
          reviewSnippet: "Engineer explained the process clearly and left the property tidy.",
          date: "2026-01-31",
        },
      ],
      faqs: [
        {
          id: `${locationSlug}-pf-1`,
          question: "How long does a power flush normally take?",
          answer: "Most domestic systems take between half a day and one full day, depending on system size.",
        },
        {
          id: `${locationSlug}-pf-2`,
          question: "How do I know if my system needs a power flush?",
          answer: "Common signs include cold radiator spots, noisy boilers, and slow warm-up times.",
        },
      ],
      seo: {
        ...base.seo,
        description:
          "Domestic power flushing in {{location}} to restore radiator heat, improve circulation, and protect boiler efficiency.",
      },
    };
  }

  return {
    ...base,
    keyword: "emergency boiler repair",
    hero: {
      ...defaultLpContent.hero,
      headline: "Need {{service}} in {{location}} today?",
      subline:
        "Local engineers solve boiler faults fast with fixed diagnostics, domestic power flushing support, and clear next steps.",
      heroImage: {
        ...defaultLpContent.hero.heroImage,
        alt: "Smiling gas engineer handling a boiler repair",
      },
    },
    trust: {
      ...defaultLpContent.trust,
      financeAvailable: true,
      guaranteeText: "12-month workmanship guarantee",
    },
    pricing: {
      diagnosticFrom: 79,
      repairRangeMin: 95,
      repairRangeMax: 450,
      installRangeMin: 1995,
      installRangeMax: 5000,
      pricingDisclaimer: "Prices vary by model, parts, and access. Final quote confirmed after diagnosis.",
      financeExample: defaultLpContent.pricing.financeExample,
    },
    faults: defaultLpContent.faults,
    proofCards: [
      {
        id: `${locationSlug}-r-1`,
        postcode: location.postcodeArea,
        serviceType: "Repair",
        outcome: "Heating restored same day",
        reviewSnippet: "Quick diagnosis and first-visit repair with clear explanation of the fault.",
        date: "2026-01-11",
      },
      {
        id: `${locationSlug}-r-2`,
        postcode: location.postcodeArea,
        serviceType: "Repair",
        outcome: "Hot water recovered",
        reviewSnippet: "Arrived on time, replaced the failed part, and tested the system fully.",
        date: "2026-01-19",
      },
    ],
    faqs: [
      {
        id: `${locationSlug}-repair-1`,
        question: "How fast can an engineer reach {{location}}?",
        answer: "Most {{location}} callouts are attended within 60 minutes during operating hours.",
      },
      {
        id: `${locationSlug}-repair-2`,
        question: "Do you confirm repair costs before work starts?",
        answer: "Yes. We begin with diagnostics, then confirm repair pricing before carrying out work.",
      },
    ],
    seo: {
      ...base.seo,
      description:
        "Rapid boiler repair in {{location}} with Gas Safe engineers, transparent pricing, and 24/7 emergency call outs.",
    },
  };
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
  const locationEntry = getLocationEntry(normalizedLocation);

  if (!rawContent && !locationEntry) {
    return null;
  }

  const resolvedContent = rawContent ?? (locationEntry ? buildGeneratedLpContent(params.service, locationEntry) : null);
  if (!resolvedContent) {
    return null;
  }

  const parsed = lpContentSchema.safeParse(mergeWithDefaults(resolvedContent));
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

export function loadQuestionsAndAnswersContent(): QuestionsAndAnswersContent | null {
  const parsed = questionsAndAnswersContentSchema.safeParse(questionsAndAnswersRaw);
  return parsed.success ? parsed.data : null;
}

export { normalizeLocationSlug };
