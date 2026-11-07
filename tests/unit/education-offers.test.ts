import { beforeAll, describe, expect, it } from "vitest";
import { buildEducationSources } from "@/modules/education/knowledge";
import { offers, offerView } from "@/modules/offers/offers";
import type { AiKnowledgeResponse } from "@/modules/crm/lib/ai-knowledge";
let forms: typeof import("@/modules/forms/api/submitLead");
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL ??= "https://empirehomesolutions.co.uk";
  process.env.NEXT_PUBLIC_CALL_NUMBER ??= "01895725151";
  forms = await import("@/modules/forms/api/submitLead");
});
const emptyKnowledge: AiKnowledgeResponse = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  version: "fixture",
  generatedAt: "2026-10-26T12:00:00.000Z",
  articles: [],
  faqs: [],
  coverage: [],
  openingHours: [],
  policies: [],
};
const body = {
  name: "Preview Example",
  phone: "07700900123",
  email: "",
  house_name_number: "1",
  street: "Example Road",
  postcode: "UB8 1AA",
  issue: "Service enquiry",
  pagePath: "/offers/boiler-service",
  origin: "https://empirehomesolutions.co.uk",
  leadType: "repair",
  service: "Forged discount",
  attribution: { utm_source: "preview", utm_campaign: "heating" },
};
describe("offer enquiry integrity", () => {
  it("rejects unknown offers and overrides client service/lead type using the validated offer", () => {
    expect(forms.leadRequestSchema.safeParse({ ...body, offerId: "free-boiler" }).success).toBe(false);
    const clean = forms.sanitizeLeadPayload(
      forms.leadRequestSchema.parse({ ...body, offerId: "power-flush" }),
      new Date("2026-10-26"),
    );
    expect(clean.leadType).toBe("power-flush");
    expect(clean.metadata.service).toBe("Offer: power flush £100 off + free boiler service");
  });
  it("deduplicates a retry while preserving different offers for the same person", () => {
    const parse = (offerId?: string) =>
      forms.sanitizeLeadPayload(forms.leadRequestSchema.parse({ ...body, offerId }));
    expect(forms.buildSubmissionFingerprint(parse("boiler-service"))).toBe(
      forms.buildSubmissionFingerprint(parse("boiler-service")),
    );
    expect(
      new Set(
        [undefined, "boiler-service", "boiler-repair", "power-flush"].map((id) =>
          forms.buildSubmissionFingerprint(parse(id)),
        ),
      ).size,
    ).toBe(4);
  });
  it("persists originating page, campaign, offer identity and server-decided expiry in CRM notes", () => {
    const clean = forms.sanitizeLeadPayload(
      forms.leadRequestSchema.parse({ ...body, offerId: "power-flush", pagePath: "/offers/power-flush" }),
      new Date("2026-10-31T00:00:00Z"),
    );
    expect(clean.metadata.offerStatus).toBe("expired_service_enquiry");
    expect(clean.metadata.service).toBe("Power flush");
    const notes = forms.buildLeadNotes(clean);
    for (const text of [
      "Originating page: /offers/power-flush",
      "Offer identifier: power-flush",
      "2026-10-30",
      "ordinary service enquiry",
      "utm_campaign: heating",
    ])
      expect(notes).toContain(text);
    expect(notes).not.toContain("£100 off");
  });
});
describe("reviewed education sources and page expiry", () => {
  it("includes prices, VAT and source references without availability promises", () => {
    const sources = buildEducationSources(emptyKnowledge, new Date("2026-10-26"));
    expect(sources.find((s) => s.id === "offer:boiler-service")?.text).toContain("£94.80 incl. VAT");
    expect(sources.find((s) => s.id === "offer:boiler-repair")?.text).toContain("£95 + VAT");
    expect(sources.find((s) => s.id === "offer:power-flush")?.text).toContain("VAT treatment");
    expect(sources.find((s) => s.id === "website:install-cost")?.text).toContain("does not specify VAT");
    expect(JSON.stringify(sources)).not.toContain("Same day or next day booking");
    expect(sources.every((s) => s.version && s.id)).toBe(true);
    expect(sources.filter((s) => s.url).every((s) => new URL(s.url!).hostname === "empire-home-solutions.vercel.app")).toBe(true);
  });
  it("ends all promotional page FAQs and chat claims at the UK deadline", () => {
    const now = new Date("2026-10-31T00:00:00Z");
    const offer = offers.find((s) => s.slug === "power-flush")!;
    expect(offerView(offer, new Date("2026-10-30T23:59:59Z")).live).toBe(true);
    const view = offerView(offer, now);
    expect(view.live).toBe(false);
    expect(JSON.stringify(view.faqs)).not.toContain("£100");
    const source = buildEducationSources(emptyKnowledge, now).find((s) => s.id === "offer:power-flush")!;
    expect(source.text).toContain("ordinary service enquiry");
    expect(source.text).not.toContain("£100 off");
  });
});
