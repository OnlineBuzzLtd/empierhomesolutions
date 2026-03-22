import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, PhoneCall } from "lucide-react";
import { businessDetails } from "@/lib/business";
import { publicEnv } from "@/lib/env";
import { FaqSection } from "@/modules/lp/components/FaqSection";
import { loadQuestionsAndAnswersContent } from "@/modules/lp/content/loadContent";
import { Section } from "@/modules/ui/Section";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const content = loadQuestionsAndAnswersContent();

  if (!content) {
    return { title: "Q&A", robots: { index: false, follow: false } };
  }

  return {
    title: content.seo.title,
    description: content.seo.description,
    alternates: {
      canonical: `${publicEnv.siteUrl}/q-and-a`,
    },
  };
}

export default function QuestionsAndAnswersPage() {
  const content = loadQuestionsAndAnswersContent();

  if (!content) {
    notFound();
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.sections.flatMap((section) =>
      section.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    ),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <Section className="pt-10" title={content.title} subtitle={content.description}>
        <div className="rounded-2xl border border-[var(--ehs-brand-accent)]/30 bg-gradient-to-r from-white to-[var(--ehs-panel)] p-5 shadow-[var(--ehs-card-shadow)] md:p-6">
          <p className="max-w-3xl text-sm text-slate-700 md:text-base">{content.intro}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`tel:${businessDetails.primaryPhoneRaw}`}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              <PhoneCall size={16} />
              Call {businessDetails.primaryPhoneDisplay}
            </a>
            <Link
              href="/lp/boiler-repair/uxbridge#lead-form"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--ehs-brand-dark)] bg-[var(--ehs-brand-dark)] px-4 py-2 text-sm font-semibold text-white"
            >
              <MessageCircle size={16} />
              Book Now
            </Link>
          </div>
        </div>
      </Section>

      {content.sections.map((section) => (
        <FaqSection key={section.id} title={section.title} subtitle={section.summary} faqs={section.faqs} />
      ))}
    </>
  );
}
