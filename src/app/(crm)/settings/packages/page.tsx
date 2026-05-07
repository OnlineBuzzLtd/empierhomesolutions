import { notFound } from "next/navigation";
import { PackageManagerForm } from "@/modules/crm/components/forms/PackageManagerForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { listProducts } from "@/modules/crm/lib/data";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import type { Package, PackageItem } from "@/modules/crm/types";

export default async function PackagesSettingsPage() {
  const session = await requireSettingsAccess();
  if (!session.user) {
    notFound();
  }

  const supabase = await createCrmServerClient();
  const [{ data: pkgRows }, products] = await Promise.all([
    supabase
      .schema("crm")
      .from("packages")
      .select("*, items:package_items(*)")
      .order("name", { ascending: true }),
    listProducts(),
  ]);

  const packages = (pkgRows ?? []) as Array<Package & { items?: PackageItem[] }>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionCard title="Quote builder packages">
        <p className="mb-4 text-sm text-slate-600">
          Reusable bundles your team can drop into a quote as a single composite line. Cost and price are copied at insert
          time, so editing a package later doesn&apos;t mutate quotes already sent.
        </p>
        <PackageManagerForm packages={packages} products={products} />
      </SectionCard>
    </div>
  );
}
