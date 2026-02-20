import { Section } from "@/modules/ui/Section";
import type { PricingContent } from "@/modules/lp/types";

type PricingSectionProps = {
  pricing: PricingContent;
  emphasizeFinance?: boolean;
};

function formatGbp(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PricingSection({ pricing, emphasizeFinance = false }: PricingSectionProps) {
  return (
    <Section title="Transparent pricing" subtitle="No hidden charges. You approve all work before we start.">
      <div className="grid gap-4 md:grid-cols-3">
        <PriceCard label="Diagnostic from" value={formatGbp(pricing.diagnosticFrom)} />
        <PriceCard
          label="Typical repair range"
          value={`${formatGbp(pricing.repairRangeMin)} - ${formatGbp(pricing.repairRangeMax)}`}
        />
        <PriceCard
          label="Typical install range"
          value={`${formatGbp(pricing.installRangeMin)} - ${formatGbp(pricing.installRangeMax)}`}
        />
      </div>
      <p className="mt-4 text-sm text-slate-600">{pricing.pricingDisclaimer}</p>
      {pricing.financeExample ? (
        <p className="mt-2 rounded-lg border border-[var(--ehs-brand-accent)]/35 bg-[var(--ehs-brand-accent-soft)] px-4 py-3 text-sm font-medium text-[var(--ehs-brand-dark)]">
          {emphasizeFinance ? "Finance focus: " : "Finance example: "}
          {pricing.financeExample.monthlyFrom > 0
            ? `From ${formatGbp(pricing.financeExample.monthlyFrom)}/month. `
            : ""}
          {pricing.financeExample.summary}
        </p>
      ) : null}
    </Section>
  );
}

type PriceCardProps = {
  label: string;
  value: string;
};

function PriceCard({ label, value }: PriceCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-4 shadow-[var(--ehs-card-shadow)]">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--ehs-brand-dark)]">{value}</p>
    </article>
  );
}
