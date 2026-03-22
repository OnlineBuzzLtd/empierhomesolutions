"use client";

import { useState } from "react";
import type { LineItem, Product } from "@/modules/crm/types";
import { buildCatalogLineItem } from "@/modules/crm/lib/quote-templates";

function createBlankLineItem(): LineItem {
  return { description: "", qty: 1, unit_price: 0 };
}

export function LineItemsEditor({
  name,
  initialItems,
  products = [],
  optionalExtras = [],
}: {
  name: string;
  initialItems?: LineItem[];
  products?: Product[];
  optionalExtras?: LineItem[];
}) {
  const [items, setItems] = useState<LineItem[]>(initialItems && initialItems.length > 0 ? initialItems : [createBlankLineItem()]);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function appendItem(item: LineItem) {
    setItems((current) => [...current, item]);
  }

  function addSelectedProduct() {
    const product = products.find((entry) => entry.id === selectedProductId);
    if (!product) {
      return;
    }

    appendItem(buildCatalogLineItem(product));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(items)} readOnly />
      {products.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Insert Catalog Product</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · £{Number(product.sell_price ?? 0).toFixed(2)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addSelectedProduct}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Add Product
            </button>
          </div>
        </div>
      ) : null}
      {optionalExtras.length > 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Optional Extras</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {optionalExtras.map((item, index) => (
              <button
                key={`${item.description}-${index}`}
                type="button"
                onClick={() => appendItem(item)}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Add {item.description} · £{Number(item.unit_price).toFixed(2)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {items.map((item, index) => (
        <div key={`${index}-${item.description}`} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_96px_120px_auto]">
          <input
            value={item.description}
            onChange={(event) => updateItem(index, { description: event.target.value })}
            placeholder="Description"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={item.qty}
            onChange={(event) => updateItem(index, { qty: Number(event.target.value) || 0 })}
            type="number"
            min="1"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={item.unit_price}
            onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) || 0 })}
            type="number"
            min="0"
            step="0.01"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setItems((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems((current) => [...current, createBlankLineItem()])}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Add line item
      </button>
    </div>
  );
}
