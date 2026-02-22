export type ServiceSlug = "boiler-repair" | "boiler-installation" | "power-flushing";

export type HeroContent = {
  eyebrow: string;
  headline: string;
  subline: string;
  primaryCta: string;
  secondaryCta: string;
  responseTimeBadge: string;
  heroImage: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
};

export type BrandLogo = {
  name: string;
  src: string;
};

export type TrustStripContent = {
  gasSafeNumber: string;
  ratingValue: number;
  ratingCount: number;
  financeAvailable: boolean;
  guaranteeText: string;
  brandLogos: BrandLogo[];
};

export type PricingContent = {
  diagnosticFrom: number;
  repairRangeMin: number;
  repairRangeMax: number;
  installRangeMin: number;
  installRangeMax: number;
  pricingDisclaimer: string;
  financeExample?: {
    monthlyFrom: number;
    summary: string;
  };
};

export type FaultListItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

export type ProofCard = {
  id: string;
  postcode: string;
  serviceType: string;
  outcome: string;
  reviewSnippet: string;
  date: string;
};

export type CoverageContent = {
  primaryTown: string;
  radiusMiles: number;
  postcodes: string[];
  regionsCovered: string[];
  outsideAreaNote: string;
};

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

export type CTAContent = {
  callLabel: string;
  quoteLabel: string;
};

export type SeoContent = {
  title: string;
  description: string;
  addressRegion: string;
};

export type LpContent = {
  slug: string;
  service: ServiceSlug;
  serviceLabel: string;
  locationLabel: string;
  keyword: string;
  hero: HeroContent;
  trust: TrustStripContent;
  pricing: PricingContent;
  faults: FaultListItem[];
  proofCards: ProofCard[];
  coverage: CoverageContent;
  faqs: FAQItem[];
  cta: CTAContent;
  seo: SeoContent;
};

export type FinanceContent = {
  slug: string;
  title: string;
  description: string;
  eligibility: string[];
  representativeExample: string;
  lenderPanelNote: string;
  fcaDisclaimer: string;
  seo: SeoContent;
};

export type AboutTrustContent = {
  slug: string;
  title: string;
  description: string;
  companyStory: string;
  engineerCredentials: string[];
  guaranteePolicy: string;
  reviewProof: string[];
  contactInfo: {
    phone: string;
    mobile: string;
    email: string;
    area: string;
  };
  gasSafeNumber: string;
  insuranceStatement: string;
  seo: SeoContent;
};
