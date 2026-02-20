import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { QuoteForm } from "@/modules/lp/components/QuoteForm";
import { Section } from "@/modules/ui/Section";
import { loadFinanceContent } from "@/modules/lp/content/loadContent";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const content = loadFinanceContent();

  if (!content) {
    return { title: "Finance", robots: { index: false, follow: false } };
  }

  return {
    title: content.seo.title,
    description: content.seo.description,
    alternates: {
      canonical: `${publicEnv.siteUrl}/finance`,
    },
  };
}

export default function FinancePage() {
  const content = loadFinanceContent();

  if (!content) {
    notFound();
  }

  return (
    <>
      <Section className="pt-10" title={content.title} subtitle={content.description}>
        <div className="grid gap-4">
          <article className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-4 shadow-[var(--ehs-card-shadow)]">
            <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Eligibility</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {content.eligibility.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-dark)] bg-white p-4 shadow-[var(--ehs-card-shadow)]">
            <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Finance terms</h2>
            <p className="mt-2 text-sm text-slate-700">{content.representativeExample}</p>
            <p className="mt-2 text-sm text-slate-700">{content.lenderPanelNote}</p>
            <p className="mt-2 text-xs text-slate-500">{content.fcaDisclaimer}</p>
          </article>
        </div>
      </Section>
      <QuoteForm leadType="finance" heading="Check eligibility" />
    </>
  );
}
