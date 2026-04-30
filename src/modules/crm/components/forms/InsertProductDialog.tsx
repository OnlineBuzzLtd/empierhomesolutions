"use client";

import { useState } from "react";
import type { LineItem, Product } from "@/modules/crm/types";

export function InsertProductDialog({
  products,
  onInsert,
}: {
  products: Product[];
  onInsert: (item: LineItem) => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);

  if (products.length === 0) {
    return null;
  }

  function handleAdd() {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    onInsert({
      description: product.name,
      qty,
      unit_price: Number(product.sell_price ?? 0),
      unit_cost: product.unit_cost === null || product.unit_cost === undefined ? null : Number(product.unit_cost),
      markup_percent: product.markup_percent ?? null,
      product_id: product.id,
      kind: "line",
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Insert product</p>
      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_80px_auto]">
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · £{Number(p.sell_price ?? 0).toFixed(2)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 1)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Add product
        </button>
      </div>
    </div>
  );
}
