"use client";

import { useMemo, useState } from "react";
import type { LineItem, Package, PackageItem, Product } from "@/modules/crm/types";
import { computeLineRollup } from "@/modules/crm/lib/quote-rollup";
import { formatCurrency } from "@/modules/crm/lib/format";
import { InsertProductDialog } from "@/modules/crm/components/forms/InsertProductDialog";
import { InsertPackageDialog } from "@/modules/crm/components/forms/InsertPackageDialog";

function blankLine(): LineItem {
  return { description: "", qty: 1, unit_price: 0, unit_cost: null, kind: "line" };
}

function blankSection(): LineItem {
  return { description: "Section title", qty: 0, unit_price: 0, kind: "section_header", section_id: `sec-${Date.now()}` };
}

export function LineItemsEditorV2({
  initialItems,
  products = [],
  packages = [],
  onChange,
}: {
  initialItems?: LineItem[];
  products?: Product[];
  packages?: Array<Package & { items?: PackageItem[] }>;
  onChange?: (items: LineItem[]) => void;
}) {
  const [items, setItems] = useState<LineItem[]>(
    initialItems && initialItems.length > 0 ? initialItems : [blankLine()],
  );

  function update(next: LineItem[]) {
    setItems(next);
    onChange?.(next);
  }

  function patch(index: number, p: Partial<LineItem>) {
    update(items.map((item, i) => (i === index ? { ...item, ...p } : item)));
  }

  function append(...rows: LineItem[]) {
    update([...items, ...rows]);
  }

  function remove(index: number) {
    if (items.length <= 1) return;
    update(items.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    update(next);
  }

  const serialized = useMemo(() => JSON.stringify(items), [items]);

  return (
    <div className="space-y-3">
      <input type="hidden" name="line_items" value={serialized} readOnly />
      <div className="grid gap-2 md:grid-cols-2">
        <InsertProductDialog products={products} onInsert={(item) => append(item)} />
        <InsertPackageDialog packages={packages} onInsert={(rows) => append(...rows)} />
      </div>

      <div className="space-y-2">
        {items.map((item, index) => {
          const kind = item.kind ?? "line";
          if (kind === "section_header") {
            return (
              <div key={`sec-${index}`} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 p-2">
                <span className="px-2 text-xs font-bold uppercase tracking-wider text-slate-500">Section</span>
                <input
                  value={item.description}
                  onChange={(e) => patch(index, { description: e.target.value })}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold"
                />
                <RowControls onUp={() => move(index, -1)} onDown={() => move(index, 1)} onRemove={() => remove(index)} />
              </div>
            );
          }
          if (kind === "package_rollup") {
            const r = computeLineRollup({ ...item, kind: "line", package_role: undefined });
            return (
              <div key={`pkg-${index}`} className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-900">Package</span>
                  <input
                    value={item.description}
                    onChange={(e) => patch(index, { description: e.target.value })}
                    className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold"
                  />
                  <RowControls onUp={() => move(index, -1)} onDown={() => move(index, 1)} onRemove={() => remove(index)} />
                </div>
                <p className="mt-2 text-xs text-amber-900">
                  Cost {formatCurrency(r.line_cost ?? 0)} · Price {formatCurrency(item.unit_price)} · Margin {r.margin_percent === null ? "—" : `${r.margin_percent.toFixed(2)}%`}
                </p>
                <p className="mt-1 text-xs italic text-amber-800">
                  Display only — totals are calculated from the package&apos;s component lines below.
                </p>
              </div>
            );
          }

          const rollup = computeLineRollup(item);
          const isComponent = item.package_role === "component";
          return (
            <div
              key={`row-${index}`}
              className={`rounded-lg border p-3 ${isComponent ? "ml-6 border-slate-200 bg-slate-50/40" : "border-slate-200"}`}
            >
              <div className="grid gap-2 md:grid-cols-[1fr_72px_120px_120px_auto]">
                <input
                  value={item.description}
                  onChange={(e) => patch(index, { description: e.target.value })}
                  placeholder="Description"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.qty}
                  onChange={(e) => patch(index, { qty: Number(e.target.value) || 0 })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cost (£)"
                  value={item.unit_cost ?? ""}
                  onChange={(e) =>
                    patch(index, {
                      unit_cost: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price (£)"
                  value={item.unit_price}
                  onChange={(e) => patch(index, { unit_price: Number(e.target.value) || 0 })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <RowControls onUp={() => move(index, -1)} onDown={() => move(index, 1)} onRemove={() => remove(index)} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Line total {formatCurrency(rollup.line_total)} · Margin{" "}
                {rollup.margin_percent === null ? "—" : `${rollup.margin_percent.toFixed(2)}%`} · Mark-up{" "}
                {rollup.markup_percent === null ? "—" : `${rollup.markup_percent.toFixed(2)}%`}
                {rollup.line_cost === null ? <span className="ml-2 text-amber-700">(no cost — margin not tracked)</span> : null}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => append(blankLine())}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Add line
        </button>
        <button
          type="button"
          onClick={() => append(blankSection())}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Add section
        </button>
      </div>
    </div>
  );
}

function RowControls({
  onUp,
  onDown,
  onRemove,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onUp}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        aria-label="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onDown}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        aria-label="Move down"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
        aria-label="Remove"
      >
        ✕
      </button>
    </div>
  );
}
