import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

let OffersHubHero: ComponentType;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL ??= "https://empirehomesolutions.co.uk";
  process.env.NEXT_PUBLIC_CALL_NUMBER ??= "01895725151";
  ({ OffersHubHero } = await import("@/modules/offers/OfferHero"));
});

describe("offers page hero", () => {
  it("leads with the boiler installation price", () => {
    const markup = renderToStaticMarkup(createElement(OffersHubHero));
    expect(markup).toContain("£1,895");
    expect(markup).toContain("£2,274 incl. VAT");
    expect(markup).toMatch(/boiler installed/i);
  });

  it("has one pulsing call-now button and no 'See the offers' button", () => {
    const markup = renderToStaticMarkup(createElement(OffersHubHero));
    expect(markup).not.toContain("See the offers");
    expect(markup).toContain("Call now");
    expect(markup).toMatch(/href="tel:/);
    expect(markup).toContain("ehs-call-pulse");
  });

  it("shows no offer end dates or countdowns", () => {
    const markup = renderToStaticMarkup(createElement(OffersHubHero));
    expect(markup).not.toMatch(/days? left|Last day to book|Limited time|Book by|ended on/);
  });
});
