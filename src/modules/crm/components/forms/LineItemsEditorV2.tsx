"use client";

import { useMemo, useState } from "react";
import type { LineItem, Package, PackageItem, Product } from "@/modules/crm/types";
import { computeLineRollup } from "@/modules/crm/lib/quote-rollup";
import { formatCurrency } from "@/modules/crm/lib/format";
import { InsertProductDialog } from "@/modules/crm/components/forms/InsertProductDialog";
import { InsertPackageDialog } from "@/modules/crm/components/forms/InsertPackageDialog";
import { PackageRollupCard } from "@/modules/crm/components/forms/PackageRollupCard";

function blankLine(): LineItem {
  return { description: "", qty: 1, unit_price: 0, unit_cost: null, kind: "line" };
}

function blankSection(): LineItem {
  return { description: "Section title", qty: 0, unit_price: 0, kind: "section_header", section_id: `sec-${Date.now()}` };
}

// Chunk the flat line_items array into sections at each section_header row.
// Items before any header land in an implicit "Unnamed Section" (matches the
// trade-portal screenshot). Purely a visual grouping — the underlying
// line_items order is unchanged, so computeQuoteRollup output is identical.
type Chunk = {
  headerIndex: number | null; // index of the section_header in `items`, or null for the implicit lead chunk
  title: string;
  rowIndices: number[];
};

function chunkBySection(items: LineItem[]): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk = { headerIndex: null, title: "Unnamed Section", rowIndices: [] };
  items.forEach((item, idx) => {
    if (item.kind === "section_header") {
      if (current.rowIndices.length > 0 || chunks.length === 0) {
        chunks.push(current);
      }
      current = { headerIndex: idx, title: item.description || "Unnamed Section", rowIndices: [] };
    } else {
      current.rowIndices.push(idx);
    }
  });
  chunks.push(current);
  // Drop any leading implicit chunk that ended up empty (i.e. the first row
  // was a header). Keeps the UI tidy.
  return chunks.filter((c, i) => !(i === 0 && c.headerIndex === null && c.rowIndices.length === 0));
}

export function LineItemsEditorV2({
  initialItems,
  products = [],
  packages = [],
  vatRate = 0.2,
  showPerPackageVat = false,
  onChange,
}: {
  initialItems?: LineItem[];
  products?: Product[];
  packages?: Array<Package & { items?: PackageItem[] }>;
  vatRate?: number;
  showPerPackageVat?: boolean;
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

  // Lookup image_url for a package_rollup row. Image is visual only — looking
  // up against the live package list, not the historic snapshot, is fine
  // (financial snapshot lives on the component rows).
  const packageImageById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of packages) m.set(p.id, p.image_url ?? null);
    return m;
  }, [packages]);

  // Find component rows immediately following a rollup row (contiguous run
  // with the same package_id and package_role === "component"). Robust to
  // intervening edits — components don't have to be adjacent to render
  // correctly, but the contiguous run is the common case.
  function componentsFollowing(rollupIndex: number, packageId: string | null | undefined): LineItem[] {
    if (!packageId) return [];
    const out: LineItem[] = [];
    for (let i = rollupIndex + 1; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "package_rollup" || it.kind === "section_header") break;
      if (it.package_role !== "component" || it.package_id !== packageId) break;
      out.push(it);
    }
    return out;
  }

  const serialized = useMemo(() => JSON.stringify(items), [items]);
  const chunks = useMemo(() => chunkBySection(items), [items]);

  return (
    <div className="space-y-3">
      <input type="hidden" name="line_items" value={serialized} readOnly />
      <div className="grid gap-2 md:grid-cols-2">
        <InsertProductDialog products={products} onInsert={(item) => append(item)} />
        <InsertPackageDialog packages={packages} onInsert={(rows) => append(...rows)} />
      </div>

      <div className="space-y-4">
        {chunks.map((chunk) => (
          <div key={`chunk-${chunk.headerIndex ?? "lead"}`} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
            {chunk.headerIndex !== null ? (
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={items[chunk.headerIndex].description}
                  onChange={(e) => patch(chunk.headerIndex as number, { description: e.target.value })}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-slate-600"
                />
                <RowControls
                  onUp={() => move(chunk.headerIndex as number, -1)}
                  onDown={() => move(chunk.headerIndex as number, 1)}
                  onRemove={() => remove(chunk.headerIndex as number)}
                />
              </div>
            ) : (
              <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Unnamed Section</p>
            )}

            <div className="space-y-2">
              {chunk.rowIndices.map((index) => {
                const item = items[index];
                const kind = item.kind ?? "line";

                if (kind === "package_rollup") {
                  const componentItems = componentsFollowing(index, item.package_id);
                  const imageUrl = item.package_id ? packageImageById.get(item.package_id) ?? null : null;
                  return (
                    <PackageRollupCard
                      key={`pkg-${index}`}
                      rollupItem={item}
                      componentItems={componentItems}
                      imageUrl={imageUrl}
                      vatRate={vatRate}
                      showVat={showPerPackageVat}
                      onDescriptionChange={(next) => patch(index, { description: next })}
                      controls={
                        <RowControls onUp={() => move(index, -1)} onDown={() => move(index, 1)} onRemove={() => remove(index)} />
                      }
                    />
                  );
                }

                const rollup = computeLineRollup(item);
                const isComponent = item.package_role === "component";
                return (
                  <div
                    key={`row-${index}`}
                    className={`rounded-lg border p-3 ${isComponent ? "ml-6 border-slate-200 bg-slate-50/60" : "border-slate-200 bg-white"}`}
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
          </div>
        ))}
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
