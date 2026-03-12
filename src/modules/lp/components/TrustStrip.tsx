import { Clock3, PoundSterling, ShieldCheck, Star } from "lucide-react";
import { businessDetails } from "@/lib/business";
import type { TrustStripContent } from "@/modules/lp/types";

type TrustStripProps = {
  trust: TrustStripContent;
  trustOrder?: "default" | "rating-first";
  showFinance?: boolean;
  diagnosticFrom?: number;
};

function formatGbp(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function TrustStrip({
  trust,
  trustOrder = "default",
  showFinance = true,
  diagnosticFrom,
}: TrustStripProps) {
  const trustItems = [
    {
      key: "gas-safe",
      icon: <ShieldCheck size={15} className="text-emerald-600" />,
      label: `Gas Safe: ${trust.gasSafeNumber}`,
      emphasize: false,
    },
    {
      key: "rating",
      icon: <Star size={15} className="fill-amber-400 text-amber-400" />,
      label: `${trust.ratingValue.toFixed(1)} (${trust.ratingCount} reviews)`,
      emphasize: false,
    },
    ...(showFinance
      ? [
          {
            key: "finance",
            icon: <PoundSterling size={15} className="text-[var(--ehs-brand-dark)]" />,
            label: trust.financeAvailable ? "Finance available over 3, 5, 8, and 10 years" : "Finance unavailable",
            emphasize: false,
          },
        ]
      : []),
    ...(typeof diagnosticFrom === "number"
      ? [
          {
            key: "diagnostic",
            icon: <PoundSterling size={15} className="text-[var(--ehs-brand-dark)]" />,
            label: `Fixed diagnostic from ${formatGbp(diagnosticFrom)}`,
            emphasize: false,
          },
        ]
      : []),
    {
      key: "guarantee",
      icon: <ShieldCheck size={15} className="text-[var(--ehs-brand-dark)]" />,
      label: trust.guaranteeText,
      emphasize: false,
    },
    {
      key: "attendance",
      icon: <Clock3 size={15} className="text-[var(--ehs-brand-dark)]" />,
      label: "Same-day attendance in core areas",
      emphasize: false,
    },
    {
      key: "emergency",
      icon: <Clock3 size={15} className="text-white" />,
      label: businessDetails.emergencyHours,
      emphasize: true,
    },
  ];

  const orderedItems =
    trustOrder === "rating-first" ? [trustItems[1], trustItems[0], ...trustItems.slice(2)] : trustItems;

  return (
    <section className="border-y border-slate-200 bg-[var(--ehs-surface-contrast)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--ehs-card-shadow)]">
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {orderedItems.map((item) => (
              <p
                key={item.key}
                className={
                  item.emphasize
                    ? "inline-flex items-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-3 py-2 text-sm font-semibold text-white"
                    : "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[var(--ehs-panel)] px-3 py-2 text-sm font-medium text-[var(--ehs-brand-dark)]"
                }
              >
                {item.icon}
                {item.label}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
