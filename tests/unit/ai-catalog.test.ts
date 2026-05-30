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
          items: [
            { id: "i1", qty: 1, unit_price: 95 },
            { id: "i2", qty: 2, unit_price: 10 },
          ],
        },
      ],
      generatedAt: "2026-05-30T11:00:00.000Z",
    });

    expect(catalog.packages[0]).toMatchObject({
      display_price: 115,
      bookable: true,
      price_enabled: true,
    });
    expect(assertAiCatalogIsRedacted(catalog)).toEqual([]);
    expect(JSON.stringify(catalog)).not.toContain("unit_cost");
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
});
