import { Section } from "@/modules/ui/Section";
import type { CoverageContent } from "@/modules/lp/types";

type CoverageSectionProps = {
  coverage: CoverageContent;
};

function groupPostcodes(postcodes: string[]) {
  return Array.from(
    new Set(
      postcodes
        .map(
          (postcode) =>
            postcode
              .trim()
              .toUpperCase()
              .match(/^[A-Z]{1,2}/)?.[0] ?? postcode.trim().toUpperCase(),
        )
        .filter(Boolean),
    ),
  );
}

export function CoverageSection({ coverage }: CoverageSectionProps) {
  const groupedPostcodes = groupPostcodes(coverage.postcodes);

  return (
    <Section
      title="Service coverage"
      subtitle={`Based in ${coverage.primaryTown}. Typical radius ${coverage.radiusMiles} miles.`}
    >
      <div className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-4 shadow-[var(--ehs-card-shadow)]">
        <p className="text-sm text-slate-500">Postcode groups</p>
        <p className="mt-1 text-lg font-semibold text-[var(--ehs-brand-dark)]">{groupedPostcodes.join(", ")}</p>
        <p className="mt-3 text-sm text-slate-500">Regions covered</p>
        <p className="mt-1 text-sm text-slate-700">{coverage.regionsCovered.join(", ")}</p>
        <p className="mt-3 inline-flex rounded-md bg-[var(--ehs-brand-accent-soft)] px-3 py-2 text-sm font-medium text-[var(--ehs-brand-dark)]">
          {coverage.outsideAreaNote}
        </p>
      </div>
    </Section>
  );
}
