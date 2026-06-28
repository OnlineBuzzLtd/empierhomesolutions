import { Section } from "@/modules/ui/Section";
import type { PricingContent } from "@/modules/lp/types";

type PricingSectionProps = {
  pricing: PricingContent;
  labels?: {
    diagnostic?: string;
    repair?: string;
    install?: string;
  };
};

function formatGbp(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatGbpWithVat(value: number) {
  return formatGbp(value * 1.2);
}

export function PricingSection({ pricing, labels }: PricingSectionProps) {
  const pricingLabels = {
    diagnostic: labels?.diagnostic ?? "Diagnostic from",
    repair: labels?.repair ?? "Typical repair range",
    install: labels?.install ?? "Typical install range",
  };

  return (
    <Section title="Transparent pricing" subtitle="No hidden charges. You approve all work before we start.">
      <div className="grid gap-4 md:grid-cols-3">
        <PriceCard
          label={pricingLabels.diagnostic}
          value={`${formatGbp(pricing.diagnosticFrom)} + VAT`}
          note={`${formatGbpWithVat(pricing.diagnosticFrom)} incl. VAT`}
        />
        <PriceCard
          label={pricingLabels.repair}
          value={`${formatGbp(pricing.repairRangeMin)} - ${formatGbp(pricing.repairRangeMax)} + VAT`}
          note={`${formatGbpWithVat(pricing.repairRangeMin)} - ${formatGbpWithVat(pricing.repairRangeMax)} incl. VAT`}
        />
        <PriceCard
          label={pricingLabels.install}
          value={`${formatGbp(pricing.installRangeMin)} - ${formatGbp(pricing.installRangeMax)} + VAT`}
          note={`${formatGbpWithVat(pricing.installRangeMin)} - ${formatGbpWithVat(pricing.installRangeMax)} incl. VAT`}
        />
      </div>
      <p className="mt-4 text-sm text-slate-600">{pricing.pricingDisclaimer}</p>
    </Section>
  );
}

type PriceCardProps = {
  label: string;
  value: string;
  note?: string;
};

function PriceCard({ label, value, note }: PriceCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-4 shadow-[var(--ehs-card-shadow)]">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--ehs-brand-dark)]">{value}</p>
      {note ? <p className="mt-1 text-sm font-medium text-slate-600">{note}</p> : null}
    </article>
  );
}
