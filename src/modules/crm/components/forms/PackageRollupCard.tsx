"use client";

import { useMemo, useState } from "react";
import type { LineItem } from "@/modules/crm/types";
import { computeLineRollup } from "@/modules/crm/lib/quote-rollup";
import { formatCurrency } from "@/modules/crm/lib/format";

// PackageRollupCard — read-mode-style card for a package snapshot inside a
// quote. The rollup row itself is display-only (filtered out of totals by
// quote-rollup.ts); all numbers shown here are summed from the *component*
// rows that follow it in line_items, via the single-source-of-truth
// computeLineRollup. Never re-derives margin math.
//
// Image is looked up by package_id at render time (visual only). If the
// upstream package is deleted, the image gracefully disappears; the
// financial snapshot in the component rows is unaffected.
export function PackageRollupCard({
  rollupItem,
  componentItems,
  imageUrl,
  vatRate,
  showVat,
  onDescriptionChange,
  controls,
}: {
  rollupItem: LineItem;
  componentItems: LineItem[];
  imageUrl: string | null;
  vatRate: number;
  showVat: boolean;
  onDescriptionChange: (next: string) => void;
  controls: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const { subtotal, cost, marginPct, vat, total } = useMemo(() => {
    let sub = 0;
    let costAccum = 0;
    let costSeen = false;
    for (const c of componentItems) {
      const r = computeLineRollup(c);
      sub += r.line_total;
      if (r.line_cost !== null) {
        costSeen = true;
        costAccum += r.line_cost;
      }
    }
    const sub2 = Math.round((sub + Number.EPSILON) * 100) / 100;
    const costFinal = costSeen ? Math.round((costAccum + Number.EPSILON) * 100) / 100 : null;
    const margin = costFinal === null || sub2 <= 0 ? null : Math.round(((sub2 - costFinal) / sub2) * 10000) / 100;
    const vatVal = Math.round((sub2 * vatRate + Number.EPSILON) * 100) / 100;
    return {
      subtotal: sub2,
      cost: costFinal,
      marginPct: margin,
      vat: vatVal,
      total: Math.round((sub2 + vatVal + Number.EPSILON) * 100) / 100,
    };
  }, [componentItems, vatRate]);

  const description = rollupItem.description || "";
  const hasDescription = description.trim().length > 0;
  const showMoreEligible = description.length > 80;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
            Package
          </span>
          <input
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Package name"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold"
          />
          {controls}
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-[120px_1fr]">
        <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant URL, no Image optimisation pipeline
            <img src={imageUrl} alt="" className="h-full w-full rounded-lg object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </div>

        <div className="space-y-3">
          {hasDescription ? (
            <div className="text-center text-sm italic text-slate-500">
              {expanded || !showMoreEligible ? description : `${description.slice(0, 80).trimEnd()}…`}
              {showMoreEligible ? (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="ml-1 font-semibold not-italic text-orange-600 hover:underline"
                >
                  {expanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="text-center text-sm italic text-slate-400">No Description</div>
          )}

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Cost</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{cost === null ? "—" : formatCurrency(cost)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">Margin</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {marginPct === null ? "—" : `${marginPct.toFixed(2)}%`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Price</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatCurrency(subtotal)}</p>
            </div>

            <div>
              <p className="text-slate-500">Qty</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">1</p>
            </div>
            {showVat ? (
              <div className="text-center">
                <p className="text-slate-500">Standard {(vatRate * 100).toFixed(0)}% VAT</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">({formatCurrency(vat)})</p>
              </div>
            ) : (
              <div />
            )}
            <div className="text-right">
              <p className="text-slate-500">Subtotal</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatCurrency(subtotal)}</p>
            </div>

            {showVat ? (
              <>
                <div />
                <div />
                <div className="text-right">
                  <p className="text-slate-500">Total</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatCurrency(total)}</p>
                </div>
              </>
            ) : null}
          </div>

          <p className="text-[11px] italic text-slate-400">
            Display only — totals are calculated from the package&apos;s component lines below.
          </p>
        </div>
      </div>
    </div>
  );
}
