import Image from "next/image";
import { businessDetails } from "@/lib/business";

/**
 * Phoenix's own finance banner, linked to their calculator. Phoenix permits
 * this banner, the IAR status disclosure (rendered by SiteFooter) and a short
 * "finance available through Phoenix" phrase - nothing else. Do not add
 * finance copy around it; tests/unit/finance-compliance.test.ts guards the
 * wording they prohibit.
 */
export function PhoenixFinanceBanner({ priority = false }: { priority?: boolean }) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--ehs-card-shadow)]">
      <a href={businessDetails.finance.calculatorUrl} target="_blank" rel="noopener noreferrer">
        <Image
          src={businessDetails.finance.bannerImageUrl}
          alt="Phoenix finance banner"
          width={1200}
          height={240}
          className="h-auto w-full"
          priority={priority}
        />
      </a>
    </article>
  );
}

/** Homepage-style section: the permitted Phoenix phrase above their banner. */
export function PhoenixFinanceSection() {
  return (
    <section id="finance" className="bg-white px-4 py-6">
      <div className="mx-auto w-full max-w-6xl space-y-2">
        <p className="text-sm font-semibold text-[var(--ehs-brand-dark)]">
          Boiler Installation Finance available through Phoenix.
        </p>
        <PhoenixFinanceBanner />
      </div>
    </section>
  );
}
