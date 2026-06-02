import { describe, expect, it } from "vitest";
import { assertAiCatalogIsRedacted, projectAiCatalog } from "@/modules/crm/lib/ai-catalog";

const tenant = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "tenant-one",
  name: "Tenant One",
};

describe("AI catalogue projection", () => {
  it("projects only active AI-visible tenant catalogue rows", () => {
    const catalog = projectAiCatalog({
      tenant,
      settings: { trade_vertical: "electrical", updated_at: "2026-05-30T10:00:00.000Z" },
      services: [
        { id: "s1", slug: "electrical-repair", name: "Electrical repair", active: true, ai_visible: true },
        { id: "s2", slug: "hidden", name: "Hidden", active: true, ai_visible: false },
        { id: "s3", slug: "inactive", name: "Inactive", active: false, ai_visible: true },
      ],
      jobTypes: [
        {
          id: "j1",
          service_id: "s1",
          slug: "fault-finding",
          name: "Fault finding",
          active: true,
          ai_visible: true,
          ai_default_duration_minutes: 90,
        },
        { id: "j2", service_id: "s1", slug: "hidden", name: "Hidden", active: true, ai_visible: false },
      ],
      generatedAt: "2026-05-30T11:00:00.000Z",
    });

    expect(catalog.tenant.trade_vertical).toBe("electrical");
    expect(catalog.services.map((service) => service.slug)).toEqual(["electrical-repair"]);
    expect(catalog.services[0]?.job_types.map((jobType) => jobType.slug)).toEqual(["fault-finding"]);
    expect(catalog.safety_policy.electrical_safety_text).toContain("electrical");
    expect(catalog.safety_policy.gas_safety_text).toBeNull();
  });

  it("redacts costs, margins, supplier terms, and markup from package pricing", () => {
    const catalog = projectAiCatalog({
      tenant,
      settings: {
        trade_vertical: "plumbing",
        ai_catalog_can_give_fixed_prices: true,
        ai_catalog_price_disclaimer: "The office confirms final pricing before work starts.",
      },
      packages: [
        {
          id: "pkg-1",
          name: "Boiler service",
          description: "Annual boiler service",
          is_active: true,
          ai_visible: true,
          ai_bookable: true,
          ai_price_enabled: true,
          ai_requires_office_quote: false,
          service_id: "s1",
          job_type_id: "j1",
          items: [
            { id: "i1", qty: 1, unit_price: 95 },
            { id: "i2", qty: 2, unit_price: 10 },
          ],
        },
      ],
      services: [{ id: "s1", slug: "boilers", name: "Boilers", active: true, ai_visible: true }],
      jobTypes: [{ id: "j1", service_id: "s1", slug: "boiler-service", name: "Boiler Service", active: true, ai_visible: true }],
      generatedAt: "2026-05-30T11:00:00.000Z",
    });

    expect(catalog.packages[0]).toMatchObject({
      service_slug: "boilers",
      job_type_slug: "boiler-service",
      display_price: 115,
      pricing_style: "from",
      bookable: true,
      price_enabled: true,
    });
    expect(assertAiCatalogIsRedacted(catalog)).toEqual([]);
    expect(JSON.stringify(catalog)).not.toContain("unit_cost");
  });

  it("excludes packages linked to hidden services or hidden job types", () => {
    const catalog = projectAiCatalog({
      tenant,
      services: [
        { id: "visible-service", slug: "boilers", name: "Boilers", active: true, ai_visible: true },
        { id: "hidden-service", slug: "hidden", name: "Hidden", active: true, ai_visible: false },
      ],
      jobTypes: [
        {
          id: "visible-job-type",
          service_id: "visible-service",
          slug: "boiler-service",
          name: "Boiler Service",
          active: true,
          ai_visible: true,
        },
        {
          id: "hidden-job-type",
          service_id: "visible-service",
          slug: "hidden",
          name: "Hidden",
          active: true,
          ai_visible: false,
        },
      ],
      packages: [
        {
          id: "pkg-visible",
          name: "Visible price",
          is_active: true,
          ai_visible: true,
          ai_price_enabled: true,
          service_id: "visible-service",
          job_type_id: "visible-job-type",
          items: [{ id: "i1", qty: 1, unit_price: 95 }],
        },
        {
          id: "pkg-hidden-service",
          name: "Hidden service price",
          is_active: true,
          ai_visible: true,
          ai_price_enabled: true,
          service_id: "hidden-service",
          items: [{ id: "i2", qty: 1, unit_price: 120 }],
        },
        {
          id: "pkg-hidden-job-type",
          name: "Hidden job type price",
          is_active: true,
          ai_visible: true,
          ai_price_enabled: true,
          service_id: "visible-service",
          job_type_id: "hidden-job-type",
          items: [{ id: "i3", qty: 1, unit_price: 150 }],
        },
      ],
      generatedAt: "2026-05-30T11:00:00.000Z",
    });

    expect(catalog.packages.map((pkg) => pkg.id)).toEqual(["pkg-visible"]);
  });

  it("redacts accidental PII from AI-visible catalogue text", () => {
    const catalog = projectAiCatalog({
      tenant,
      settings: {
        ai_catalog_price_disclaimer: "Call Jane on +44 7700 900123 before pricing.",
        ai_catalog_emergency_escalation_text: "Do not mention tenant contact jane@example.com.",
      },
      services: [
        {
          id: "s1",
          slug: "repair",
          name: "Repair",
          active: true,
          ai_visible: true,
          description: "Previous customer was at 10 Test Street, SW1A 1AA. Email jane@example.com.",
          ai_price_disclaimer: "Phone 07700 900123 for approval.",
        },
      ],
      jobTypes: [
        {
          id: "j1",
          service_id: "s1",
          slug: "callout",
          name: "Callout",
          active: true,
          ai_visible: true,
          description: "Ask for +44 7700 900456 only internally.",
        },
      ],
      packages: [
        {
          id: "pkg-1",
          name: "Package",
          description: "Legacy note: owner@example.com, E1 2BT.",
          is_active: true,
          ai_visible: true,
          ai_price_enabled: true,
          items: [{ id: "i1", qty: 1, unit_price: 120 }],
        },
      ],
      generatedAt: "2026-05-30T11:00:00.000Z",
    });

    const json = JSON.stringify(catalog);

    expect(json).not.toContain("jane@example.com");
    expect(json).not.toContain("owner@example.com");
    expect(json).not.toContain("+44 7700 900123");
    expect(json).not.toContain("07700 900123");
    expect(json).not.toContain("SW1A 1AA");
    expect(json).not.toContain("E1 2BT");
    expect(json).toContain("[redacted email]");
    expect(json).toContain("[redacted phone]");
    expect(json).toContain("[redacted postcode]");
    expect(assertAiCatalogIsRedacted(catalog)).toEqual([]);
  });

  it("uses a stable tenant-specific version and changes when relevant data changes", () => {
    const base = projectAiCatalog({
      tenant,
      services: [{ id: "s1", slug: "repair", name: "Repair", active: true, ai_visible: true, updated_at: "a" }],
      generatedAt: "2026-05-30T11:00:00.000Z",
    });
    const repeated = projectAiCatalog({
      tenant,
      services: [{ id: "s1", slug: "repair", name: "Repair", active: true, ai_visible: true, updated_at: "a" }],
      generatedAt: "2026-05-30T12:00:00.000Z",
    });
    const changed = projectAiCatalog({
      tenant,
      services: [{ id: "s1", slug: "repair", name: "Repair", active: true, ai_visible: true, updated_at: "b" }],
      generatedAt: "2026-05-30T11:00:00.000Z",
    });

    expect(repeated.version).toBe(base.version);
    expect(changed.version).not.toBe(base.version);
  });

  it("falls back unknown verticals to general trades", () => {
    const catalog = projectAiCatalog({
      tenant,
      settings: { trade_vertical: "empire_only" as never },
      generatedAt: "2026-05-30T11:00:00.000Z",
    });

    expect(catalog.tenant.trade_vertical).toBe("general_trades");
  });

  it("exposes survey-first booking guidance for install and powerflush work", () => {
    const catalog = projectAiCatalog({
      tenant,
      settings: { trade_vertical: "heating" },
      generatedAt: "2026-06-01T11:00:00.000Z",
    });

    expect(catalog.booking_rules).toMatchObject({
      requires_office_quote_for_installations: true,
      survey_first_for_installations_and_powerflush: true,
    });
  });
});
