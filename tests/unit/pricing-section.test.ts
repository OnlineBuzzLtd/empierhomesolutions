import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PricingSection } from "@/modules/lp/components/PricingSection";

describe("PricingSection", () => {
  it("shows plus-VAT prices and including-VAT totals", () => {
    const html = renderToStaticMarkup(
      createElement(PricingSection, {
        pricing: {
          diagnosticFrom: 79,
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
});
