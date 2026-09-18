import { describe, expect, it } from "vitest";
import type { AiCatalogResponse } from "@/modules/crm/lib/ai-catalog";
import { projectAiKnowledge } from "@/modules/crm/lib/ai-knowledge";

const catalog: AiCatalogResponse = {
  tenant: {
    id: "tenant-1",
    slug: "empire",
    name: "Empire Home Solutions",
    trade_vertical: "heating",
    timezone: "Europe/London",
    currency: "GBP",
    vat_mode: "exclusive",
  },
  version: "catalog-v1",
  generated_at: "2026-07-14T10:00:00.000Z",
  channels: {
    whatsapp: { uses_catalog: true },
    sms: { uses_catalog: true },
    web_chat: { uses_catalog: true },
    voice: { uses_catalog: true },
  },
  services: [
    {
      id: "service-1",
      slug: "boiler-service",
      name: "Boiler service",
      description: "Annual boiler service.",
      active: true,
      bookable: true,
      price_enabled: true,
      requires_office_quote: false,
      estimated_duration_minutes: 60,
      price_disclaimer: "The office confirms final pricing.",
      job_types: [],
    },
  ],
  packages: [
    {
      id: "package-1",
      service_id: "service-1",
      job_type_id: null,
      service_slug: "boiler-service",
      service_name: "Boiler service",
      job_type_slug: null,
      job_type_name: null,
      name: "Standard boiler service",
      description: "Standard service package.",
      display_price: 99,
      vat_category: null,
      pricing_style: "fixed",
      price_disclaimer: "The office confirms final pricing.",
      bookable: true,
      price_enabled: true,
      requires_office_quote: false,
      estimated_duration_minutes: 60,
    },
  ],
  booking_rules: {
    default_duration_minutes: 60,
    emergency_duration_minutes: 120,
    can_quote_prices_in_chat: true,
    requires_office_quote_for_installations: true,
    survey_first_for_installations_and_powerflush: true,
  },
  pricing_policy: {
    can_give_fixed_prices: true,
    can_give_from_prices: true,
    fallback_phrase: "The office confirms final pricing before work starts.",
  },
  safety_policy: {
    emergency_escalation_text: "Call emergency services if there is immediate danger.",
    gas_safety_text: "Call the gas emergency line if you smell gas.",
    electrical_safety_text: null,
  },
};

describe("projectAiKnowledge", () => {
  it("projects the AI catalogue into CRM-grounded answer knowledge", () => {
    const knowledge = projectAiKnowledge(catalog);

    expect(knowledge.tenantId).toBe("tenant-1");
    expect(knowledge.version).toBe("knowledge:catalog-v1");
    expect(knowledge.articles.map((article) => article.id)).toContain("service:boiler-service");
    expect(knowledge.articles.map((article) => article.id)).toContain("package:package-1");
    expect(knowledge.faqs.map((faq) => faq.id)).toContain("faq:services");
    expect(knowledge.policies.map((policy) => policy.id)).toEqual(
      expect.arrayContaining([
        "policy:emergency",
        "policy:pricing",
        "policy:booking-boundary",
        "policy:cancellation",
        "policy:warranty",
        "policy:finance",
        "policy:company-info",
      ])
    );
    expect(JSON.stringify(knowledge)).not.toContain("unit_cost");
  });
});
