import { z } from "zod";

export const heroContentSchema = z.object({
  eyebrow: z.string().min(2),
  headline: z.string().min(6),
  subline: z.string().min(10),
  primaryCta: z.string().min(2),
  secondaryCta: z.string().min(2),
  responseTimeBadge: z.string().min(2),
  heroImage: z.object({
    src: z.string().min(1),
    alt: z.string().min(2),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
});

export const trustStripSchema = z.object({
  gasSafeNumber: z.string().min(4),
  ratingValue: z.number().min(0).max(5),
  ratingCount: z.number().int().min(0),
  financeAvailable: z.boolean(),
  guaranteeText: z.string().min(4),
  brandLogos: z
    .array(
      z.object({
        name: z.string().min(2),
        src: z.string().min(1),
      }),
    )
    .min(1),
});

export const pricingSchema = z.object({
  diagnosticFrom: z.number().nonnegative(),
  repairRangeMin: z.number().nonnegative(),
  repairRangeMax: z.number().nonnegative(),
  installRangeMin: z.number().nonnegative(),
  installRangeMax: z.number().nonnegative(),
  pricingDisclaimer: z.string().min(10),
  financeExample: z
    .object({
      monthlyFrom: z.number().nonnegative(),
      summary: z.string().min(6),
    })
    .optional(),
});

export const faultItemSchema = z.object({
  id: z.string().min(2),
  title: z.string().min(2),
  description: z.string().min(8),
  icon: z.string().min(2),
});

export const proofCardSchema = z.object({
  id: z.string().min(2),
  postcode: z.string().min(2),
  serviceType: z.string().min(2),
  outcome: z.string().min(4),
  reviewSnippet: z.string().min(8),
  date: z.string().date(),
});

export const coverageSchema = z.object({
  primaryTown: z.string().min(2),
  radiusMiles: z.number().positive(),
  postcodes: z.array(z.string().min(2)).min(1),
  regionsCovered: z.array(z.string().min(2)).min(1),
  outsideAreaNote: z.string().min(4),
});

export const faqSchema = z.object({
  id: z.string().min(2),
  question: z.string().min(4),
  answer: z.string().min(8),
});

export const questionsAndAnswersSectionSchema = z.object({
  id: z.string().min(2),
  title: z.string().min(4),
  summary: z.string().min(8),
  faqs: z.array(faqSchema).min(1),
});

export const ctaSchema = z.object({
  callLabel: z.string().min(2),
  quoteLabel: z.string().min(2),
});

export const seoSchema = z.object({
  title: z.string().min(4),
  description: z.string().min(8),
  addressRegion: z.string().min(2),
});

export const lpContentSchema = z.object({
  slug: z.string().min(4),
  service: z.enum(["boiler-repair", "boiler-installation", "power-flushing"]),
  serviceLabel: z.string().min(4),
  locationLabel: z.string().min(2),
  keyword: z.string().min(2),
  hero: heroContentSchema,
  trust: trustStripSchema,
  pricing: pricingSchema,
  faults: z.array(faultItemSchema),
  proofCards: z.array(proofCardSchema).min(1),
  coverage: coverageSchema,
  faqs: z.array(faqSchema).min(1),
  cta: ctaSchema,
  seo: seoSchema,
});

export const financeContentSchema = z.object({
  slug: z.literal("finance"),
  title: z.string().min(4),
  description: z.string().min(8),
  eligibility: z.array(z.string().min(4)).min(1),
  representativeExample: z.string().min(12),
  lenderPanelNote: z.string().min(8),
  fcaDisclaimer: z.string().min(8),
  seo: seoSchema,
});

export const aboutTrustContentSchema = z.object({
  slug: z.literal("about-trust"),
  title: z.string().min(4),
  description: z.string().min(8),
  companyStory: z.string().min(12),
  engineerCredentials: z.array(z.string().min(4)).min(1),
  guaranteePolicy: z.string().min(8),
  reviewProof: z.array(z.string().min(6)).min(1),
  contactInfo: z.object({
    phone: z.string().min(6),
    mobile: z.string().min(6),
    email: z.string().email(),
    area: z.string().min(2),
  }),
  gasSafeNumber: z.string().min(4),
  insuranceStatement: z.string().min(8),
  seo: seoSchema,
});

export const questionsAndAnswersContentSchema = z.object({
  slug: z.literal("q-and-a"),
  title: z.string().min(4),
  description: z.string().min(8),
  intro: z.string().min(16),
  sections: z.array(questionsAndAnswersSectionSchema).min(1),
  seo: seoSchema,
});

export type LpContentInput = z.infer<typeof lpContentSchema>;
export type FinanceContentInput = z.infer<typeof financeContentSchema>;
export type AboutTrustContentInput = z.infer<typeof aboutTrustContentSchema>;
export type QuestionsAndAnswersContentInput = z.infer<typeof questionsAndAnswersContentSchema>;
