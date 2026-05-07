import { describe, expect, it } from "vitest";
import { expandPackageToLineItems } from "@/modules/crm/lib/packages";
import { computeQuoteRollup } from "@/modules/crm/lib/quote-rollup";
import type { Package, PackageItem } from "@/modules/crm/types";

const pkg: Package = {
  id: "pkg-1",
  tenant_id: "t",
  name: "Boiler install",
  description: null,
  default_markup_percent: null,
  is_active: true,
  created_by: null,
  created_at: "",
  updated_at: "",
};

const items: PackageItem[] = [
  { id: "i1", tenant_id: "t", package_id: "pkg-1", product_id: null, description: "Boiler", qty: 1, unit_cost: 900, unit_price: 1500, sort_order: 0 },
  { id: "i2", tenant_id: "t", package_id: "pkg-1", product_id: null, description: "Labour", qty: 1, unit_cost: 985, unit_price: 1500, sort_order: 1 },
];

describe("expandPackageToLineItems", () => {
  it("emits a rollup row + components in order", () => {
    const result = expandPackageToLineItems(pkg, items);
    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe("package_rollup");
    expect(result[0].package_role).toBe("rollup");
    expect(result[1].package_role).toBe("component");
    expect(result[2].package_role).toBe("component");
  });

  it("rollup row carries summed price and cost", () => {
    const [rollup] = expandPackageToLineItems(pkg, items);
    expect(rollup.unit_price).toBe(3000);
    expect(rollup.unit_cost).toBe(1885);
  });

  it("expanded items integrate cleanly with computeQuoteRollup (no double count)", () => {
    const expanded = expandPackageToLineItems(pkg, items);
    const r = computeQuoteRollup(expanded, 0.2);
    expect(r.subtotal).toBe(3000);
    expect(r.total_cost).toBe(1885);
    expect(r.total).toBe(3600);
  });

  it("rollup unit_cost is null when no item has cost", () => {
    const noCost = items.map((i) => ({ ...i, unit_cost: null }));
    const [rollup] = expandPackageToLineItems(pkg, noCost);
    expect(rollup.unit_cost).toBeNull();
  });
});
