"use client";

import { useState } from "react";
import type { LineItem } from "@/modules/crm/types";

export function LineItemsEditor({ name, initialItems }: { name: string; initialItems?: LineItem[] }) {
  const [items, setItems] = useState<LineItem[]>(
    initialItems && initialItems.length > 0 ? initialItems : [{ description: "", qty: 1, unit_price: 0 }],
  );

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(items)} readOnly />
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
        onClick={() => setItems((current) => [...current, { description: "", qty: 1, unit_price: 0 }])}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Add line item
      </button>
    </div>
  );
}
