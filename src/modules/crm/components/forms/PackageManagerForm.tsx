"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Package, PackageItem, Product } from "@/modules/crm/types";
import { formatCurrency } from "@/modules/crm/lib/format";

type EditableItem = Omit<PackageItem, "id" | "tenant_id" | "package_id"> & { id?: string };

type EditableState = {
  name: string;
  description: string;
  default_markup_percent: string;
  is_active: boolean;
  items: EditableItem[];
};

function blankItem(sortOrder: number): EditableItem {
  return {
    description: "",
    qty: 1,
    unit_cost: null,
    unit_price: 0,
    sort_order: sortOrder,
    product_id: null,
  };
}

function blankState(): EditableState {
  return { name: "", description: "", default_markup_percent: "", is_active: true, items: [blankItem(0)] };
}

function fromPackage(pkg: Package & { items?: PackageItem[] }): EditableState {
  return {
    name: pkg.name,
    description: pkg.description ?? "",
    default_markup_percent: pkg.default_markup_percent === null || pkg.default_markup_percent === undefined ? "" : String(pkg.default_markup_percent),
    is_active: pkg.is_active,
    items: (pkg.items ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((it) => ({
        id: it.id,
        product_id: it.product_id,
        description: it.description,
        qty: Number(it.qty),
        unit_cost: it.unit_cost === null || it.unit_cost === undefined ? null : Number(it.unit_cost),
        unit_price: Number(it.unit_price),
        sort_order: it.sort_order,
      })),
  };
}

export function PackageManagerForm({
  packages,
  products,
}: {
  packages: Array<Package & { items?: PackageItem[] }>;
  products: Product[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [state, setState] = useState<EditableState>(blankState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setEditingId(null);
    setState(blankState());
    setError(null);
  }

  function startEdit(pkg: Package & { items?: PackageItem[] }) {
    setEditingId(pkg.id);
    setState(fromPackage(pkg));
    setError(null);
  }

  function patchItem(i: number, p: Partial<EditableItem>) {
    setState({ ...state, items: state.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)) });
  }

  function addItem() {
    setState({ ...state, items: [...state.items, blankItem(state.items.length)] });
  }

  function removeItem(i: number) {
    if (state.items.length <= 1) return;
    setState({ ...state, items: state.items.filter((_, idx) => idx !== i) });
  }

  function applyProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) {
      patchItem(i, { product_id: null });
      return;
    }
    patchItem(i, {
      product_id: p.id,
      description: p.name,
      unit_cost: p.unit_cost === null || p.unit_cost === undefined ? null : Number(p.unit_cost),
      unit_price: Number(p.sell_price ?? 0),
    });
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    const body = {
      name: state.name,
      description: state.description || null,
      default_markup_percent: state.default_markup_percent === "" ? null : Number(state.default_markup_percent),
      is_active: state.is_active,
      items: state.items.map((it, idx) => ({
        product_id: it.product_id ?? null,
        description: it.description,
        qty: it.qty,
        unit_cost: it.unit_cost,
        unit_price: it.unit_price,
        sort_order: idx,
      })),
    };
    const endpoint = editingId ? `/api/crm/packages/${editingId}` : "/api/crm/packages";
    const method = editingId ? "PUT" : "POST";
    const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    setSubmitting(false);
    if (!response.ok) {
      setError(result.error ?? "Save failed.");
      return;
    }
    setEditingId(null);
    setState(blankState());
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this package?")) return;
    const response = await fetch(`/api/crm/packages/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({ error: "Delete failed." }));
      setError(result.error ?? "Delete failed.");
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setState(blankState());
    }
    router.refresh();
  }

  const itemsTotal = state.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.unit_price), 0);
  const itemsCost = state.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.unit_cost ?? 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.6fr_1fr]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Packages</h3>
          <button type="button" onClick={startNew} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
            New package
          </button>
        </div>
        {packages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No packages yet.</p>
        ) : (
          <ul className="space-y-2">
            {packages.map((pkg) => (
              <li key={pkg.id} className={`rounded-lg border p-3 ${editingId === pkg.id ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{pkg.name}</p>
                    <p className="text-xs text-slate-500">{pkg.items?.length ?? 0} items{pkg.is_active ? "" : " · inactive"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(pkg)} className="text-xs text-blue-700 hover:underline">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(pkg.id)} className="text-xs text-rose-700 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold">{editingId ? "Edit package" : "New package"}</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            placeholder="Package name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={state.default_markup_percent}
            onChange={(e) => setState({ ...state, default_markup_percent: e.target.value })}
            placeholder="Default mark-up %"
            type="number"
            step="0.01"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={state.description}
            onChange={(e) => setState({ ...state, description: e.target.value })}
            placeholder="Description (optional)"
            className="min-h-16 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.is_active}
              onChange={(e) => setState({ ...state, is_active: e.target.checked })}
            />
            Active
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Items</p>
          {state.items.map((it, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_60px_100px_100px_auto]">
                <input
                  value={it.description}
                  onChange={(e) => patchItem(i, { description: e.target.value })}
                  placeholder="Description"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={it.qty}
                  onChange={(e) => patchItem(i, { qty: Number(e.target.value) || 1 })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cost"
                  value={it.unit_cost ?? ""}
                  onChange={(e) => patchItem(i, { unit_cost: e.target.value === "" ? null : Number(e.target.value) })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={it.unit_price}
                  onChange={(e) => patchItem(i, { unit_price: Number(e.target.value) || 0 })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => removeItem(i)} className="text-xs text-rose-600 hover:underline">
                  Remove
                </button>
              </div>
              {products.length > 0 ? (
                <div className="mt-2">
                  <select
                    value={it.product_id ?? ""}
                    onChange={(e) => applyProduct(i, e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value="">Or pick a product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · £{Number(p.sell_price ?? 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ))}
          <button type="button" onClick={addItem} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Add item
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Items cost</p>
            <p className="mt-1 font-semibold">{formatCurrency(itemsCost)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Items price</p>
            <p className="mt-1 font-semibold">{formatCurrency(itemsTotal)}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || !state.name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? "Saving…" : editingId ? "Save changes" : "Create package"}
          </button>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
