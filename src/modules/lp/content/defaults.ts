import type { LpContentInput } from "@/modules/lp/content/schema";

export const defaultLpContent: LpContentInput = {
  slug: "boiler-repair-default",
  service: "boiler-repair",
  serviceLabel: "Boiler Repair",
  locationLabel: "West London",
  keyword: "local boiler engineer",
  hero: {
    eyebrow: "Heating and Gas Engineers",
    headline: "Fast {{service}} in {{location}}",
    subline: "Book a same-day engineer for {{keyword}} across {{location}} with 24/7 emergency support.",
    primaryCta: "Call Now",
    secondaryCta: "Book Now",
    responseTimeBadge: "24/7 emergency call out",
    heroImage: {
      src: "/images/plumber-smiling.jpg",
      alt: "Smiling gas engineer repairing a domestic boiler",
      width: 720,
      height: 480,
    },
  },
  trust: {
    gasSafeNumber: "918273",
    ratingValue: 4.9,
    ratingCount: 412,
    financeAvailable: true,
    guaranteeText: "12 month workmanship guarantee",
    brandLogos: [
      { name: "Worcester", src: "/brands/worcester.svg" },
      { name: "Vaillant", src: "/brands/vaillant.svg" },
      { name: "Ideal", src: "/brands/ideal.svg" },
    ],
  },
  pricing: {
    diagnosticFrom: 79,
    repairRangeMin: 95,
    repairRangeMax: 450,
    installRangeMin: 1995,
    installRangeMax: 5000,
    pricingDisclaimer: "Final price depends on boiler make, access, and part availability.",
    financeExample: {
      monthlyFrom: 0,
      summary:
        "Finance available over 3, 5, 8, and 10 years. Interest rates are discussed at quote appointment.",
    },
  },
  faults: [
    {
      id: "no-heat",
      title: "No heat",
      description: "Radiators cold even when thermostat is on.",
      icon: "flame",
    },
    {
      id: "no-hot-water",
      title: "No hot water",
      description: "Intermittent or no hot water at taps.",
      icon: "droplets",
    },
    {
      id: "leak",
      title: "Leak",
      description: "Visible leak from valves, pipework, or the boiler body.",
      icon: "wrench",
    },
    {
      id: "low-pressure",
      title: "Low pressure",
      description: "Pressure gauge drops and boiler locks out.",
      icon: "gauge",
    },
    {
      id: "kettling",
      title: "Kettling",
      description: "Boiler making rumbling sounds due to scale build-up.",
      icon: "bell",
    },
    {
      id: "error-codes",
      title: "Error codes",
      description: "Recurring fault codes preventing normal operation.",
      icon: "triangle-alert",
    },
  ],
  proofCards: [
    {
      id: "proof-1",
      postcode: "UB8",
      serviceType: "Boiler Repair",
      outcome: "Restored heat same day",
      reviewSnippet: "Engineer arrived in 45 minutes and fixed ignition fault immediately.",
      date: "2026-01-11",
    },
  ],
  coverage: {
    primaryTown: "West London",
    radiusMiles: 12,
    postcodes: ["UB", "HA", "SL"],
    regionsCovered: [
      "West London",
      "Greater London",
      "Buckinghamshire",
      "Hertfordshire",
      "Berkshire",
      "Surrey",
    ],
    outsideAreaNote: "Outside area? Call to confirm",
  },
  faqs: [
    {
      id: "faq-response",
      question: "How quickly can you get here?",
      answer: "Most emergency calls in core areas are visited within 60 minutes.",
    },
  ],
  cta: {
    callLabel: "Call Now",
    quoteLabel: "Book Now",
  },
  seo: {
    title: "Boiler Repair in {{location}} | Empire Home Solutions",
    description: "Gas Safe boiler repair across {{location}} with rapid callouts and fixed pricing.",
    addressRegion: "West London",
  },
};
