import type { FAQItem } from "@/modules/lp/types";

export type OfferSlug = "boiler-repair" | "boiler-service" | "power-flush";

/** Icon keys resolved to lucide icons by the offer components. */
export type OfferIcon = "wrench" | "flame" | "droplets";

type OfferHero = {
  eyebrow: string;
  headline: string;
  subline: string;
};

type OfferReason = { title: string; body: string };

export type Offer = {
  slug: OfferSlug;
  /** Short card title, as printed on the flyer. */
  title: string;
  tagline: string;
  icon: OfferIcon;
  /** Price label shown above the amount, e.g. "From" or "Only". */
  priceLead?: string;
  /** Net price in pounds, before VAT. Omitted for discount-only offers. */
  priceNet?: number;
  /** Discount headline for offers without a fixed price. */
  discountLabel?: string;
  /** Extra shown with the discount, e.g. a bundled free service. */
  discountExtra?: string;
  /** Last UK calendar day the offer can be booked, inclusive (YYYY-MM-DD). */
  bookBy?: string;
  priceNote: string;
  included: string[];
  hero: OfferHero;
  reasons: { title: string; items: OfferReason[] };
  /** Recorded on the CRM enquiry so the office knows which offer was claimed. */
  lead: { leadType: "repair" | "power-flush"; service: string };
  faqs: FAQItem[];
  seo: { title: string; description: string };
  /** Copy that replaces the offer once its book-by date has passed. */
  ended?: {
    hero: OfferHero;
    seo: { title: string; description: string };
    priceNote: string;
    /** FAQ ids that only make sense while the offer is running. */
    dropFaqIds: string[];
  };
};

export const offers: Offer[] = [
  {
    slug: "boiler-repair",
    title: "Boiler repairs",
    tagline: "Get it fixed from",
    icon: "wrench",
    priceLead: "From",
    priceNet: 79,
    priceNote: "Fast, reliable repairs to get your heating back on track.",
    included: [
      "Fault finding and diagnosis",
      "Labour included for minor repairs",
      "No hidden charges",
      "Same day or next day booking available",
    ],
    hero: {
      eyebrow: "Heating offer",
      headline: "Boiler repairs from £79 + VAT",
      subline:
        "No heating or hot water? A Gas Safe engineer will find the fault and fix minor repairs with labour included, with same day or next day booking.",
    },
    reasons: {
      title: "Faults we fix every week",
      items: [
        { title: "No heating or hot water", body: "We trace the fault and get your boiler running again." },
        { title: "Boiler lockouts and error codes", body: "We diagnose the code and fix the cause, not just reset it." },
        { title: "Low pressure and leaks", body: "We find where the pressure is going and stop it." },
      ],
    },
    lead: { leadType: "repair", service: "Offer: boiler repair from £79 + VAT" },
    faqs: [
      {
        id: "offer-repair-included",
        question: "What does the £79 + VAT cover?",
        answer:
          "Fault finding and diagnosis, plus labour for minor repairs. If your boiler needs parts or a bigger repair, we explain the price before any work starts.",
      },
      {
        id: "offer-repair-booking",
        question: "How quickly can you come out?",
        answer: "Same day or next day booking is available. Call us or send the form and we will confirm a time.",
      },
      {
        id: "offer-repair-hidden",
        question: "Are there any hidden charges?",
        answer: "No. You approve the price before we start, and there is no hidden call-out charge.",
      },
    ],
    seo: {
      title: "Boiler Repairs from £79 + VAT | Empire Home Solutions",
      description:
        "Gas Safe boiler repairs from £79 + VAT. Fault finding, diagnosis and labour for minor repairs, with same or next day booking.",
    },
  },
  {
    slug: "boiler-service",
    title: "Full boiler service",
    tagline: "Keep your home safe and efficient",
    icon: "flame",
    priceLead: "Only",
    priceNet: 79,
    priceNote: "Better performance, greater peace of mind.",
    included: [
      "Improve efficiency",
      "Enhanced safety",
      "Fewer breakdowns",
      "Maintain your manufacturer warranty",
    ],
    hero: {
      eyebrow: "Heating offer",
      headline: "Full boiler service only £79 + VAT",
      subline:
        "Keep your home safe and efficient before winter. A yearly service helps prevent breakdowns and keeps your manufacturer warranty valid.",
    },
    reasons: {
      title: "Why service your boiler every year",
      items: [
        { title: "Stay safe", body: "We check your boiler is burning safely and venting properly." },
        { title: "Avoid winter breakdowns", body: "Small faults are caught early, before they leave you without heat." },
        { title: "Keep your warranty", body: "Most manufacturers need a yearly service to keep the warranty valid." },
      ],
    },
    lead: { leadType: "repair", service: "Offer: full boiler service £79 + VAT" },
    faqs: [
      {
        id: "offer-service-why",
        question: "Why service my boiler every year?",
        answer:
          "A yearly service keeps your boiler running safely and efficiently, helps prevent breakdowns, and most manufacturers need it to keep your warranty valid.",
      },
      {
        id: "offer-service-brands",
        question: "Which boilers do you service?",
        answer: "We service all major gas boiler brands, including Vaillant, Glow-worm and Worcester.",
      },
      {
        id: "offer-service-booking",
        question: "How do I book?",
        answer: "Call us, message us on WhatsApp, or send the form and we will confirm a time that suits you.",
      },
    ],
    seo: {
      title: "Full Boiler Service £79 + VAT | Empire Home Solutions",
      description:
        "Full boiler service for only £79 + VAT from a Gas Safe registered engineer. Improve efficiency and safety and keep your warranty valid.",
    },
  },
  {
    slug: "power-flush",
    title: "Power flush",
    tagline: "Improve, protect, save",
    icon: "droplets",
    discountLabel: "£100 off",
    discountExtra: "+ a free boiler service",
    bookBy: "2026-10-30",
    priceNote: "£100 off a power flush plus a free boiler service.",
    included: [
      "Removes sludge, rust and limescale",
      "Restores heating efficiency for lower energy bills",
      "Quieter operation and a longer boiler life",
      "Helps prevent breakdowns",
    ],
    hero: {
      eyebrow: "Limited time offer",
      headline: "£100 off a power flush + a free boiler service",
      subline:
        "Clear out the sludge, rust and limescale so your radiators heat evenly and your boiler works less hard. We service your boiler on the same visit.",
    },
    reasons: {
      title: "Signs your system needs a power flush",
      items: [
        { title: "Cold spots on radiators", body: "Radiators warm at the top but stay cold at the bottom." },
        { title: "A noisy boiler", body: "Banging or kettling sounds from sludge restricting the flow." },
        { title: "Slow to heat up", body: "Rooms take longer to warm and your energy bills creep up." },
      ],
    },
    lead: { leadType: "power-flush", service: "Offer: power flush £100 off + free boiler service" },
    faqs: [
      {
        id: "offer-flush-need",
        question: "How do I know if I need a power flush?",
        answer:
          "Cold spots on radiators, a noisy boiler, slow warm-up and radiators that keep needing bleeding are common signs of sludge in the system.",
      },
      {
        id: "offer-flush-deadline",
        question: "When does the offer end?",
        answer: "Book before 30 October 2026 to get £100 off your power flush and a free boiler service.",
      },
      {
        id: "offer-flush-price",
        question: "How much does a power flush cost?",
        answer:
          "It depends on how many radiators you have and how much sludge is in the system. We give you a clear fixed price, with the £100 discount applied, before any work starts.",
      },
    ],
    seo: {
      title: "£100 Off a Power Flush + Free Boiler Service | Empire Home Solutions",
      description:
        "Limited time: £100 off a power flush plus a free boiler service when you book before 30 October 2026. Gas Safe engineers.",
    },
    ended: {
      hero: {
        eyebrow: "Heating and Gas Engineers",
        headline: "Power flushing from a Gas Safe engineer",
        subline:
          "Clear out the sludge, rust and limescale so your radiators heat evenly and your boiler works less hard.",
      },
      seo: {
        title: "Power Flushing | Empire Home Solutions",
        description:
          "Power flushing to remove sludge, rust and limescale and restore heating efficiency. Gas Safe engineers.",
      },
      priceNote: "Power flushing to remove sludge and restore your heating.",
      dropFaqIds: ["offer-flush-deadline"],
    },
  },
];

export function getOffer(slug: string): Offer | null {
  return offers.find((offer) => offer.slug === slug) ?? null;
}

/** Today's calendar date in the UK as YYYY-MM-DD. */
function ukDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * True until the end of the offer's book-by day in UK time. Offers without a
 * book-by date are standing prices and never expire.
 */
export function isOfferLive(offer: Offer, now: Date = new Date()): boolean {
  return !offer.bookBy || ukDate(now) <= offer.bookBy;
}

/** UK calendar days left to book, counting the final day; null for standing offers. */
export function daysLeftToBook(offer: Offer, now: Date = new Date()): number | null {
  if (!offer.bookBy) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const days = (Date.parse(`${offer.bookBy}T00:00:00Z`) - Date.parse(`${ukDate(now)}T00:00:00Z`)) / dayMs + 1;
  return Math.max(0, days);
}

/** The copy to show for an offer right now, falling back once it has ended. */
export function offerView(offer: Offer, now: Date = new Date()) {
  const live = isOfferLive(offer, now);
  if (live || !offer.ended) {
    return { live, hero: offer.hero, seo: offer.seo, priceNote: offer.priceNote, faqs: offer.faqs };
  }
  const { ended } = offer;
  return {
    live,
    hero: ended.hero,
    seo: ended.seo,
    priceNote: ended.priceNote,
    faqs: offer.faqs.filter((faq) => !ended.dropFaqIds.includes(faq.id)),
  };
}

export function formatBookBy(offer: Offer): string | null {
  if (!offer.bookBy) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${offer.bookBy}T00:00:00Z`));
}

function formatGbp(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatOfferPrice(net: number) {
  const gross = Math.round(net * 120) / 100;
  return { net: `${formatGbp(net)} + VAT`, gross: `${formatGbp(gross)} incl. VAT` };
}
