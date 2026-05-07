"use client";

import { useState } from "react";
import type { LineItem, Package, PackageItem } from "@/modules/crm/types";
import { expandPackageToLineItems } from "@/modules/crm/lib/packages";

export function InsertPackageDialog({
  packages,
  onInsert,
}: {
  packages: Array<Package & { items?: PackageItem[] }>;
  onInsert: (items: LineItem[]) => void;
}) {
  const active = packages.filter((p) => p.is_active);
  const [packageId, setPackageId] = useState(active[0]?.id ?? "");

  if (active.length === 0) {
    return null;
  }

  function handleAdd() {
    const pkg = active.find((p) => p.id === packageId);
    if (!pkg) return;
    const expanded = expandPackageToLineItems(pkg, pkg.items ?? []);
    onInsert(expanded);
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Insert package</p>
      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
        <select
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
        >
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
        >
          Add package
        </button>
      </div>
    </div>
  );
}
