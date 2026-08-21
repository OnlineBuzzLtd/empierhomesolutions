import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PricingSection } from "@/modules/lp/components/PricingSection";

describe("PricingSection", () => {
  it("shows plus-VAT prices and including-VAT totals", () => {
    const html = renderToStaticMarkup(
      createElement(PricingSection, {
        pricing: {
          diagnosticFrom: 95,
          repairRangeMin: 95,
          repairRangeMax: 450,
          installRangeMin: 1995,
          installRangeMax: 5000,
          pricingDisclaimer: "Prices are shown plus VAT with the including-VAT total alongside.",
        },
      }),
    );

    expect(html).toContain("£95 - £450 + VAT");
    expect(html).toContain("£114 - £540 incl. VAT");
    expect(html).toContain("including-VAT");
  });

  it("renders the diagnostic card from the configured price", () => {
    const html = renderToStaticMarkup(
      createElement(PricingSection, {
        pricing: {
          diagnosticFrom: 95,
          repairRangeMin: 150,
          repairRangeMax: 450,
          installRangeMin: 1995,
          installRangeMax: 5000,
          pricingDisclaimer: "Prices are shown plus VAT with the including-VAT total alongside.",
        },
      }),
    );

    // Distinct repair range here so the diagnostic assertion can't be satisfied
    // by the repair card — the previous test's ranges both start at £95.
    expect(html).toContain("Diagnostic from");
    expect(html).toContain("£95 + VAT");
    expect(html).toContain("£114 incl. VAT");
  });
});

describe("landing page pricing content", () => {
  it("advertises the same diagnostic price everywhere it is authored", async () => {
    // The diagnostic price is hand-authored in the shared default, in the two
    // generated-LP branches, and in each location JSON. They drifted apart
    // before; this pins them together.
    const { defaultLpContent } = await import("@/modules/lp/content/defaults");
    const locations = await Promise.all([
      import("@/modules/lp/content/locations/hayes.boiler-repair.json"),
      import("@/modules/lp/content/locations/uxbridge.boiler-repair.json"),
      import("@/modules/lp/content/locations/hayes.power-flushing.json"),
      import("@/modules/lp/content/locations/uxbridge.power-flushing.json"),
    ]);

    expect(defaultLpContent.pricing.diagnosticFrom).toBe(95);
    for (const location of locations) {
      expect(location.default.pricing.diagnosticFrom).toBe(95);
    }
  });
});
