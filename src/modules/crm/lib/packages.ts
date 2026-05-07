// Packages: tenant-scoped reusable bundles. When inserted into a quote,
// items are *copied* (snapshot) into line_items so editing a package
// later never mutates a historic quote.

import type { LineItem, Package, PackageItem } from "@/modules/crm/types";

type SupabaseLike = {
  schema: (schema: string) => {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
          order: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
      };
    };
  };
};

export async function fetchPackageWithItems(
  supabase: SupabaseLike,
  tenantId: string,
  packageId: string,
): Promise<{ pkg: Package; items: PackageItem[] }> {
  const pkgResult = (await supabase
    .schema("crm")
    .from("packages")
    .select("*")
    .eq("id", packageId)
    .maybeSingle()) as { data: Package | null; error: { message?: string } | null };

  if (pkgResult.error) {
    throw new Error(pkgResult.error.message ?? "Failed to load package.");
  }
  if (!pkgResult.data || pkgResult.data.tenant_id !== tenantId) {
    throw new Error("Package not found.");
  }

  const itemsResult = (await supabase
    .schema("crm")
    .from("package_items")
    .select("*")
    .eq("package_id", packageId)
    .order("sort_order", { ascending: true })) as { data: PackageItem[] | null; error: { message?: string } | null };

  if (itemsResult.error) {
    throw new Error(itemsResult.error.message ?? "Failed to load package items.");
  }

  return { pkg: pkgResult.data, items: itemsResult.data ?? [] };
}

// Expand a package into a sequence of LineItems suitable for splicing
// into a quote's line_items array. Emits one rollup display row plus
// one component row per package item. The rollup carries package_id +
// package_role='rollup' (display-only, skipped by computeQuoteRollup),
// while components carry package_id + package_role='component' and
// drive the math.
export function expandPackageToLineItems(pkg: Package, items: PackageItem[]): LineItem[] {
  const sectionId = `pkg-${pkg.id}`;
  const totalCost = items.reduce((sum, it) => sum + (it.unit_cost ?? 0) * Number(it.qty), 0);
  const totalPrice = items.reduce((sum, it) => sum + Number(it.unit_price) * Number(it.qty), 0);

  const rollup: LineItem = {
    description: pkg.name,
    qty: 1,
    unit_price: Number(totalPrice.toFixed(2)),
    unit_cost: items.every((it) => it.unit_cost === null || it.unit_cost === undefined)
      ? null
      : Number(totalCost.toFixed(2)),
    package_id: pkg.id,
    package_role: "rollup",
    section_id: sectionId,
    kind: "package_rollup",
  };

  const components: LineItem[] = items.map((it) => ({
    description: it.description,
    qty: Number(it.qty),
    unit_price: Number(it.unit_price),
    unit_cost: it.unit_cost === null || it.unit_cost === undefined ? null : Number(it.unit_cost),
    product_id: it.product_id ?? null,
    package_id: pkg.id,
    package_role: "component",
    section_id: sectionId,
    kind: "line",
  }));

  return [rollup, ...components];
}
