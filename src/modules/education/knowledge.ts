import { createHash } from "node:crypto";
import type { AiKnowledgeResponse } from "@/modules/crm/lib/ai-knowledge";
import questions from "@/modules/lp/content/q-and-a.json";
import { offers, offerView, formatOfferPrice } from "@/modules/offers/offers";

export type EducationSource = {
  id: string;
  title: string;
  text: string;
  url?: string;
  version: string;
  expiresOn?: string;
  expiredText?: string;
};
// The public domain's existing forwarder only handles its homepage. Link to
// the live website host so every source remains reachable without DNS changes.
const origin = "https://empire-home-solutions.vercel.app";
// Reviewed informational FAQs. Availability promises and grant eligibility
// are deliberately excluded from this educational source pack.
const reviewedFaqIds = new Set([
  "install-cost",
  "install-planning",
  "install-best",
  "powerflush-what",
  "powerflush-worth",
  "powerflush-new-boiler",
  "powerflush-access",
  "engineer-rate",
  "engineer-role",
  "engineer-choice",
  "service-frequency",
  "service-cost",
  "service-skip",
  "service-length",
]);

export function buildEducationSources(knowledge: AiKnowledgeResponse, now = new Date()): EducationSource[] {
  const version = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);
  const sources: EducationSource[] = knowledge.articles
    .filter((article) => article.topic === "service_discovery")
    .map((article) => ({
      id: `crm:${article.id}`,
      title: `CRM catalogue: ${article.title}`,
      text: article.body.replaceAll("available to book", "offered by Empire"),
      version: article.source.version,
    }));
  for (const group of questions.sections) {
    for (const faq of group.faqs.filter((item) => reviewedFaqIds.has(item.id))) {
      const text =
        faq.answer +
        (faq.id === "install-cost"
          ? " This published guide does not specify VAT treatment; the office needs to confirm VAT and the final quote."
          : "");
      sources.push({
        id: `website:${faq.id}`,
        title: faq.question,
        text,
        url: `${origin}/q-and-a#${group.id}`,
        version: version(text),
      });
    }
  }
  for (const offer of offers) {
    const view = offerView(offer, now);
    const expiredText = `The ${offer.title.toLowerCase()} promotion ended on ${offer.bookBy}. It is now an ordinary service enquiry. The office needs to confirm the current price; the expired discount and free service do not apply.`;
    let text: string;
    if (!view.live) text = expiredText;
    else if (offer.priceNet !== undefined) {
      const price = formatOfferPrice(offer.priceNet);
      text = `${offer.title}: ${offer.priceLead === "From" ? "from " : ""}${price.net} (${price.gross}, at 20% VAT), as published on this offer page. `;
      text +=
        offer.slug === "boiler-repair"
          ? "This covers fault finding, diagnosis and labour for minor repairs. Parts or larger repairs need a separate price confirmed by the office. The standard website also advertises a diagnostic from £95 + VAT; the office needs to confirm which price applies to your enquiry."
          : "This is the published full boiler service offer. The office needs to confirm suitability and the final quote.";
    } else {
      text = `Power flush promotion: £100 off plus a free boiler service, when booked by ${offer.bookBy} inclusive in UK time. The total power flush price depends on the system. The published discount does not specify its VAT treatment; the office needs to confirm VAT, eligibility and the final quote. Sending an enquiry does not secure the promotion or an appointment.`;
    }
    sources.push({
      id: `offer:${offer.slug}`,
      title: `${offer.title} ${view.live ? "offer" : "service enquiry"}`,
      text,
      url: `${origin}/offers/${offer.slug}`,
      version: version(text),
      ...(offer.bookBy ? { expiresOn: offer.bookBy, expiredText } : {}),
    });
    for (const faq of view.faqs.filter((item) =>
      ["offer-service-brands", "offer-flush-need", "offer-service-why"].includes(item.id),
    )) {
      sources.push({
        id: `offer-faq:${faq.id}`,
        title: faq.question,
        text: faq.answer,
        url: `${origin}/offers/${offer.slug}#faq`,
        version: version(faq.answer),
      });
    }
  }
  for (const item of knowledge.coverage) {
    const text = [item.label, ...item.areas, ...item.postcodes, item.notes].filter(Boolean).join(". ");
    sources.push({ id: `crm:${item.id}`, title: "CRM service coverage", text, version: item.source.version });
  }
  for (const item of knowledge.openingHours) {
    sources.push({
      id: `crm:${item.id}`,
      title: item.label,
      text: `${item.hoursText} (${item.timezone}). Opening hours do not confirm appointment availability.`,
      version: item.source.version,
    });
  }
  for (const item of knowledge.policies.filter((p) => p.topic === "emergency")) {
    sources.push({ id: `crm:${item.id}`, title: item.title, text: item.body, version: item.source.version });
  }
  return sources;
}
