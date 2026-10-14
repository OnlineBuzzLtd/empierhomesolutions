import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OfferPriceCard } from "@/modules/offers/OfferPriceCard";
import { formatOfferPrice, getOffer, isOfferLive, offers, offerView } from "@/modules/offers/offers";

function offer(slug: string) {
  const found = getOffer(slug);
  if (!found) throw new Error(`missing offer ${slug}`);
  return found;
}

describe("heating offers", () => {
  it("publishes the three flyer offers under unique slugs", () => {
    expect(offers.map((item) => item.slug)).toEqual(["boiler-repair", "boiler-service", "power-flush"]);
    expect(getOffer("not-an-offer")).toBeNull();
  });

  it("shows plus-VAT prices with the including-VAT total in pence", () => {
    expect(formatOfferPrice(79)).toEqual({ net: "£79 + VAT", gross: "£94.80 incl. VAT" });
    expect(formatOfferPrice(100)).toEqual({ net: "£100 + VAT", gross: "£120 incl. VAT" });
  });

  it("keeps the power flush offer live until the end of 30 October (UK time)", () => {
    const flush = offer("power-flush");
    expect(isOfferLive(flush, new Date("2026-10-14T09:00:00Z"))).toBe(true);
    // 30 October 2026 is after the clocks go back, so UK time is GMT.
    expect(isOfferLive(flush, new Date("2026-10-30T23:59:00Z"))).toBe(true);
    expect(isOfferLive(flush, new Date("2026-10-31T00:00:00Z"))).toBe(false);
  });

  it("never expires the standing £79 prices", () => {
    expect(isOfferLive(offer("boiler-repair"), new Date("2030-01-01T00:00:00Z"))).toBe(true);
    expect(isOfferLive(offer("boiler-service"), new Date("2030-01-01T00:00:00Z"))).toBe(true);
  });

  it("stops advertising the power flush discount once it has ended", () => {
    const live = renderToStaticMarkup(
      createElement(OfferPriceCard, { offer: offer("power-flush"), now: new Date("2026-10-20T12:00:00Z") }),
    );
    const ended = renderToStaticMarkup(
      createElement(OfferPriceCard, { offer: offer("power-flush"), now: new Date("2026-11-02T12:00:00Z") }),
    );

    expect(live).toContain("£100 off");
    expect(live).toContain("Book before 30 October 2026");
    expect(ended).not.toContain("£100 off");
    expect(ended).toContain("This offer ended on 30 October 2026");
  });

  it("drops the discount from the power flush page copy once it has ended", () => {
    const flush = offer("power-flush");
    const live = offerView(flush, new Date("2026-10-20T12:00:00Z"));
    const ended = offerView(flush, new Date("2026-11-02T12:00:00Z"));

    expect(live.hero.headline).toContain("£100 off");
    expect(live.seo.title).toContain("£100 Off");
    expect(live.faqs.some((faq) => faq.id === "offer-flush-deadline")).toBe(true);

    const endedCopy = JSON.stringify(ended);
    expect(endedCopy).not.toMatch(/£100 off/i);
    expect(endedCopy).not.toContain("Book before");
    expect(ended.faqs.some((faq) => faq.id === "offer-flush-deadline")).toBe(false);
  });

  it("renders the £79 price card with the VAT-inclusive total", () => {
    const html = renderToStaticMarkup(
      createElement(OfferPriceCard, { offer: offer("boiler-service"), now: new Date("2026-10-20T12:00:00Z") }),
    );
    expect(html).toContain("£79 + VAT");
    expect(html).toContain("£94.80 incl. VAT");
  });
});
