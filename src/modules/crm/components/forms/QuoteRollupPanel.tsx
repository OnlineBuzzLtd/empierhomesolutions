"use client";

import { useMemo } from "react";
import type { LineItem } from "@/modules/crm/types";
import { computeQuoteRollup } from "@/modules/crm/lib/quote-rollup";
import { formatCurrency } from "@/modules/crm/lib/format";

function formatPct(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

function formatMoneyOrDash(value: number | null) {
  return value === null ? "—" : formatCurrency(value);
}

export function QuoteRollupPanel({
  lineItems,
  vatRate,
  className,
}: {
  lineItems: LineItem[];
  vatRate: number;
  className?: string;
}) {
  const rollup = useMemo(() => computeQuoteRollup(lineItems, vatRate), [lineItems, vatRate]);

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Cost</p>
          <p className="mt-1 font-semibold text-slate-900">{formatMoneyOrDash(rollup.total_cost)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Profit</p>
          <p className="mt-1 font-semibold text-emerald-700">{formatMoneyOrDash(rollup.total_profit)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Margin</p>
          <p className="mt-1 font-semibold text-slate-900">{formatPct(rollup.total_margin_percent)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Mark-up</p>
          <p className="mt-1 font-semibold text-slate-900">{formatPct(rollup.total_markup_percent)}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Subtotal</dt>
          <dd className="text-slate-900">{formatCurrency(rollup.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">VAT ({(vatRate * 100).toFixed(0)}%)</dt>
          <dd className="text-slate-900">{formatCurrency(rollup.vat)}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatCurrency(rollup.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
