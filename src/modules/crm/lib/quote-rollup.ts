// Pure math for quote builder rollups.
//
// Single source of truth shared by client (live UI) and server (writes
// `crm.quotes.subtotal`, `total`, `total_cost`, `total_profit`,
// `total_margin_percent`). The client display must always agree with
// what the server persists, which is enforced by feeding the same
// function the same input on both sides.

import type { LineItem } from "@/modules/crm/types";

export type QuoteRollup = {
  subtotal: number;
  vat: number;
  total: number;
  total_cost: number | null;
  total_profit: number | null;
  total_margin_percent: number | null;
  total_markup_percent: number | null;
};

export type LineRollup = {
  line_total: number;
  line_cost: number | null;
  line_profit: number | null;
  margin_percent: number | null;
  markup_percent: number | null;
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isPriced(item: LineItem): boolean {
  // section_header rows have no monetary effect.
  // package_rollup rows are display-only — their components carry
  // the cost/price; counting both would double the totals.
  if (item.kind === "section_header") return false;
  if (item.kind === "package_rollup") return false;
  if (item.package_role === "rollup") return false;
  return true;
}

export function computeLineRollup(item: LineItem): LineRollup {
  if (!isPriced(item)) {
    return { line_total: 0, line_cost: null, line_profit: null, margin_percent: null, markup_percent: null };
  }

  const qty = Number(item.qty ?? 0);
  const price = Number(item.unit_price ?? 0);
  const line_total = round2(qty * price);

  const hasCost = item.unit_cost !== null && item.unit_cost !== undefined;
  if (!hasCost) {
    return { line_total, line_cost: null, line_profit: null, margin_percent: null, markup_percent: null };
  }

  const cost = Number(item.unit_cost);
  const line_cost = round2(qty * cost);
  const line_profit = round2(line_total - line_cost);
  const margin_percent = line_total > 0 ? round2(((line_total - line_cost) / line_total) * 100) : null;
  const markup_percent = line_cost > 0 ? round2(((line_total - line_cost) / line_cost) * 100) : null;

  return { line_total, line_cost, line_profit, margin_percent, markup_percent };
}

export function computeQuoteRollup(lineItems: LineItem[], vatRate: number): QuoteRollup {
  let subtotal = 0;
  let costAccum = 0;
  let costSeen = false;
  let costMissing = false;

  for (const item of lineItems) {
    if (!isPriced(item)) continue;

    const rollup = computeLineRollup(item);
    subtotal += rollup.line_total;

    if (rollup.line_cost === null) {
      costMissing = true;
    } else {
      costSeen = true;
      costAccum += rollup.line_cost;
    }
  }

  subtotal = round2(subtotal);
  const vat = round2(subtotal * Number(vatRate ?? 0));
  const total = round2(subtotal + vat);

  // If no priced row carries a cost, we cannot report cost/profit/margin
  // honestly. We surface null rather than 0 so the UI can show "—".
  // If at least one row carries a cost but others are missing, we still
  // show partial cost (best-effort), and margin computed against subtotal.
  const total_cost = costSeen ? round2(costAccum) : null;
  const total_profit = total_cost === null ? null : round2(subtotal - total_cost);
  const total_margin_percent =
    total_cost === null || subtotal <= 0 ? null : round2(((subtotal - total_cost) / subtotal) * 100);
  const total_markup_percent =
    total_cost === null || total_cost <= 0 ? null : round2(((subtotal - total_cost) / total_cost) * 100);

  void costMissing; // reserved for future "partial cost" UI flag

  return { subtotal, vat, total, total_cost, total_profit, total_margin_percent, total_markup_percent };
}
