import type { Metadata } from "next";
import Image from "next/image";
import { businessDetails, phoenixFinanceDisclosure } from "@/lib/business";
import { publicEnv } from "@/lib/env";
import { Section } from "@/modules/ui/Section";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Finance Option | Empire Home Solutions",
  description: "Finance option available through Phoenix Financial Consultants Limited.",
  alternates: {
    canonical: `${publicEnv.siteUrl}/finance`,
  },
};

export default function FinancePage() {
  return (
    <Section
      className="pt-10"
      title="Finance Option"
      subtitle="Finance option available through Phoenix Financial Consultants Limited."
    >
      <div className="grid gap-4">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--ehs-card-shadow)]">
          <a href={businessDetails.finance.calculatorUrl} target="_blank" rel="noopener noreferrer">
            <Image
              src={businessDetails.finance.bannerImageUrl}
              alt="Phoenix finance banner"
              width={1200}
              height={240}
              className="h-auto w-full"
              priority
            />
          </a>
        </article>
        <article className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-dark)] bg-white p-4 shadow-[var(--ehs-card-shadow)]">
          <p className="text-xs leading-relaxed text-slate-600">{phoenixFinanceDisclosure}</p>
        </article>
      </div>
    </Section>
  );
}
