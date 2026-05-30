import { Suspense } from "react";
import { InvoicesClientPanel } from "@/modules/crm/components/client/CrmHotListPanels";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { crmPaginationFromSearchParams } from "@/modules/crm/lib/performance";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const demoState = await getCrmDemoState();
  const params = await searchParams;
  const pagination = crmPaginationFromSearchParams(params);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">Track invoices, overdue payments, and what needs chasing.</p>
      </div>

      <Suspense fallback={<SectionCard title="Invoices"><p className="text-sm text-slate-500">Loading invoices...</p></SectionCard>}>
        <InvoicesClientPanel pagination={pagination} params={params} demoActive={demoState.active} />
      </Suspense>
    </div>
  );
}
