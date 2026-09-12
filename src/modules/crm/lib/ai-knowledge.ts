import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAiCatalogForTenant, type AiCatalogResponse } from "@/modules/crm/lib/ai-catalog";

type KnowledgeChannel = "webchat" | "sms" | "whatsapp" | "voice" | "email";
type KnowledgeTopic =
  | "book"
  | "reschedule"
  | "cancel"
  | "pricing"
  | "faq"
  | "service_discovery"
  | "coverage"
  | "opening_hours"
  | "policy"
  | "emergency"
  | "company_info"
  | "handoff"
  | "noise"
  | "unsupported";

type KnowledgeSource = {
  sourceType: "crm_catalogue" | "crm_settings" | "crm_policy" | "crm_route" | "website" | "manual";
  sourceId: string;
  tenantId: string;
  version: string;
  lastUpdatedAt: string;
  confidence: number;
};

type AnswerPolicy = {
  canQuote: boolean;
  requiresOfficeConfirmation: boolean;
  requiresHandoff: boolean;
  allowedChannels: KnowledgeChannel[];
};

export type AiKnowledgeResponse = {
  tenantId: string;
  version: string;
  generatedAt: string;
  articles: Array<{
    id: string;
    topic: KnowledgeTopic;
    title: string;
    body: string;
    tags: string[];
    source: KnowledgeSource;
    answerPolicy: AnswerPolicy;
  }>;
  faqs: Array<{
    id: string;
    question: string;
    answer: string;
    tags: string[];
    source: KnowledgeSource;
    answerPolicy: AnswerPolicy;
  }>;
  coverage: Array<{
    id: string;
    label: string;
    areas: string[];
    postcodes: string[];
    notes?: string;
    source: KnowledgeSource;
    answerPolicy: AnswerPolicy;
  }>;
  openingHours: Array<{
    id: string;
    label: string;
    timezone: string;
    hoursText: string;
    source: KnowledgeSource;
    answerPolicy: AnswerPolicy;
  }>;
  policies: Array<{
    id: string;
    topic: KnowledgeTopic;
    title: string;
    body: string;
    tags: string[];
    source: KnowledgeSource;
    answerPolicy: AnswerPolicy;
  }>;
};

const allowedChannels: KnowledgeChannel[] = ["webchat", "sms", "whatsapp", "voice", "email"];

const defaultPolicy: AnswerPolicy = {
  canQuote: false,
  requiresOfficeConfirmation: false,
  requiresHandoff: false,
  allowedChannels,
};

export function projectAiKnowledge(catalog: AiCatalogResponse): AiKnowledgeResponse {
  const source = (sourceType: KnowledgeSource["sourceType"], sourceId: string, confidence = 1): KnowledgeSource => ({
    sourceType,
    sourceId,
    tenantId: catalog.tenant.id,
    version: catalog.version,
    lastUpdatedAt: catalog.generated_at,
    confidence,
  });

  const serviceArticles = catalog.services
    .filter((service) => service.bookable)
    .map((service) => ({
      id: `service:${service.slug}`,
      topic: "service_discovery" as const,
      title: service.name,
      body: [
        service.description || `${service.name} is available to book.`,
        service.estimated_duration_minutes ? `Estimated duration is ${service.estimated_duration_minutes} minutes.` : null,
        service.requires_office_quote ? "The office confirms the final quote before work starts." : null,
      ]
        .filter(Boolean)
        .join(" "),
      tags: [
        service.slug,
        service.name,
        ...(service.job_types ?? []).flatMap((jobType) => [jobType.slug, jobType.name]),
      ].map((tag) => tag.toLowerCase()),
      source: source("crm_catalogue", `catalogue:service:${service.slug}`),
      answerPolicy: {
        ...defaultPolicy,
        requiresOfficeConfirmation: service.requires_office_quote,
      },
    }));

  const packageArticles = catalog.packages
    .filter((pkg) => pkg.bookable || pkg.price_enabled)
    .map((pkg) => ({
      id: `package:${pkg.id}`,
      topic: "pricing" as const,
      title: pkg.name,
      body: [
        pkg.description || `${pkg.name} is listed in the CRM package catalogue.`,
        pkg.display_price !== null
          ? `${pkg.pricing_style === "fixed" ? "Fixed" : "From"} price is GBP ${pkg.display_price.toFixed(2)} excluding VAT.`
          : pkg.price_disclaimer,
      ]
        .filter(Boolean)
        .join(" "),
      tags: [
        pkg.name,
        pkg.service_slug,
        pkg.service_name,
        pkg.job_type_slug,
        pkg.job_type_name,
        "price",
        "pricing",
        "cost",
      ]
        .filter(Boolean)
        .map((tag) => String(tag).toLowerCase()),
      source: source("crm_catalogue", `catalogue:package:${pkg.id}`),
      answerPolicy: {
        ...defaultPolicy,
        canQuote: pkg.price_enabled && pkg.display_price !== null,
        requiresOfficeConfirmation: pkg.requires_office_quote,
      },
    }));

  const serviceNames = catalog.services.filter((service) => service.bookable).map((service) => service.name);
  const pricePolicy: AnswerPolicy = {
    ...defaultPolicy,
    canQuote: catalog.pricing_policy.can_give_fixed_prices || catalog.pricing_policy.can_give_from_prices,
    requiresOfficeConfirmation: true,
  };

  return {
    tenantId: catalog.tenant.id,
    version: `knowledge:${catalog.version}`,
    generatedAt: catalog.generated_at,
    articles: [...serviceArticles, ...packageArticles],
    faqs: [
      {
        id: "faq:services",
        question: "What services do you offer?",
        answer: `Empire can help with ${formatList(serviceNames)}.`,
        tags: ["services", "offer", "help", "book"],
        source: source("crm_catalogue", `catalogue:services:${catalog.tenant.id}`),
        answerPolicy: defaultPolicy,
      },
      {
        id: "faq:pricing",
        question: "How much does it cost?",
        answer: catalog.pricing_policy.fallback_phrase,
        tags: ["price", "pricing", "cost", "quote", "how much"],
        source: source("crm_policy", `catalogue:pricing:${catalog.tenant.id}`),
        answerPolicy: pricePolicy,
      },
      {
        id: "faq:emergency",
        question: "Can you help in an emergency?",
        answer: catalog.safety_policy.emergency_escalation_text,
        tags: ["emergency", "urgent", "danger", "gas", "leak"],
        source: source("crm_policy", `catalogue:safety:${catalog.tenant.id}`),
        answerPolicy: {
          ...defaultPolicy,
          requiresHandoff: true,
        },
      },
      {
        id: "faq:company",
        question: "Who is this?",
        answer: `${catalog.tenant.name} is the CRM tenant this AI receptionist is serving.`,
        tags: ["company", "business", catalog.tenant.slug, catalog.tenant.name.toLowerCase()],
        source: source("crm_catalogue", `catalogue:tenant:${catalog.tenant.id}`),
        answerPolicy: defaultPolicy,
      },
    ],
    coverage: [
      {
        id: "coverage:office-confirmed",
        label: "Office-confirmed service area",
        areas: [],
        postcodes: [],
        notes: "The AI receptionist must collect the address or postcode and let the CRM booking workflow validate coverage before confirming an appointment.",
        source: source("crm_policy", `catalogue:coverage:${catalog.tenant.id}`),
        answerPolicy: {
          ...defaultPolicy,
          requiresOfficeConfirmation: true,
        },
      },
    ],
    openingHours: [
      {
        id: "opening-hours:office-confirmed",
        label: "Office-confirmed opening hours",
        timezone: catalog.tenant.timezone,
        hoursText:
          "Opening hours and engineer availability are confirmed by the office calendar. I can take the job details and check availability before confirming a booking.",
        source: source("crm_policy", `catalogue:opening-hours:${catalog.tenant.id}`),
        answerPolicy: {
          ...defaultPolicy,
          requiresOfficeConfirmation: true,
        },
      },
    ],
    policies: [
      {
        id: "policy:emergency",
        topic: "emergency",
        title: "Emergency safety",
        body: [
          catalog.safety_policy.emergency_escalation_text,
          catalog.safety_policy.gas_safety_text,
          catalog.safety_policy.electrical_safety_text,
        ]
          .filter(Boolean)
          .join(" "),
        tags: ["emergency", "urgent", "gas", "electric", "safety", "danger"],
        source: source("crm_policy", `catalogue:safety:${catalog.tenant.id}`),
        answerPolicy: {
          ...defaultPolicy,
          requiresHandoff: true,
        },
      },
      {
        id: "policy:pricing",
        topic: "pricing",
        title: "Pricing policy",
        body: catalog.pricing_policy.fallback_phrase,
        tags: ["price", "pricing", "quote", "cost"],
        source: source("crm_policy", `catalogue:pricing:${catalog.tenant.id}`),
        answerPolicy: pricePolicy,
      },
      {
        id: "policy:booking-boundary",
        topic: "policy",
        title: "Booking commit boundary",
        body:
          "A booking is only confirmed after a real calendar hold exists, the customer explicitly accepts the slot, and the CRM booking event is saved.",
        tags: ["booking", "confirmation", "calendar", "crm"],
        source: source("crm_policy", `catalogue:booking-boundary:${catalog.tenant.id}`),
        answerPolicy: defaultPolicy,
      },
      {
        id: "policy:cancellation",
        topic: "policy",
        title: "Cancellation and rescheduling",
        body:
          "Cancellation and rescheduling requests for existing bookings must be handled by the office workflow before the customer is told the booking has changed.",
        tags: ["cancel", "cancellation", "reschedule", "change booking"],
        source: source("crm_policy", `catalogue:cancellation:${catalog.tenant.id}`),
        answerPolicy: {
          ...defaultPolicy,
          requiresOfficeConfirmation: true,
        },
      },
      {
        id: "policy:warranty",
        topic: "policy",
        title: "Warranty policy",
        body:
          "Warranty, guarantee, and aftercare details must be confirmed by the office or the written job record before the AI receptionist makes any commitment.",
        tags: ["warranty", "guarantee", "aftercare"],
        source: source("crm_policy", `catalogue:warranty:${catalog.tenant.id}`),
        answerPolicy: {
          ...defaultPolicy,
          requiresOfficeConfirmation: true,
        },
      },
      {
        id: "policy:finance",
        topic: "policy",
        title: "Finance and payment claims",
        body:
          "Finance, credit, and payment-plan claims must be confirmed by approved office material. The AI receptionist can collect booking details but must not invent finance terms.",
        tags: ["finance", "payment", "credit", "payment plan"],
        source: source("crm_policy", `catalogue:finance:${catalog.tenant.id}`),
        answerPolicy: {
          ...defaultPolicy,
          requiresOfficeConfirmation: true,
          requiresHandoff: true,
        },
      },
      {
        id: "policy:company-info",
        topic: "company_info",
        title: "Approved company facts",
        body: `${catalog.tenant.name} is configured as a ${catalog.tenant.trade_vertical.replaceAll("_", " ")} CRM tenant using GBP and the ${catalog.tenant.timezone} timezone.`,
        tags: ["company", "about", catalog.tenant.slug, catalog.tenant.name.toLowerCase()],
        source: source("crm_catalogue", `catalogue:tenant:${catalog.tenant.id}`),
        answerPolicy: defaultPolicy,
      },
    ],
  };
}

export async function buildAiKnowledgeForTenant(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<AiKnowledgeResponse | null> {
  const catalog = await buildAiCatalogForTenant(supabase, tenantId);
  return catalog ? projectAiKnowledge(catalog) : null;
}

function formatList(values: string[]) {
  const clean = values.filter(Boolean);
  if (!clean.length) return "the services in the CRM catalogue";
  if (clean.length === 1) return clean[0]!;
  if (clean.length === 2) return `${clean[0]!} or ${clean[1]!}`;
  return `${clean.slice(0, -1).join(", ")}, or ${clean.at(-1)}`;
}
