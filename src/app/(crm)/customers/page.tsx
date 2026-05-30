import { Suspense } from "react";
import { CustomersClientPanel } from "@/modules/crm/components/client/CrmHotListPanels";
import { CustomerCreateForm } from "@/modules/crm/components/forms/CustomerCreateForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { listCustomFieldDefinitions } from "@/modules/crm/lib/data";
import { crmPaginationFromSearchParams } from "@/modules/crm/lib/performance";

async function CustomerCreatePanel() {
  const customFields = await listCustomFieldDefinitions();

  return (
    <SectionCard title="New Customer">
      <CustomerCreateForm customFields={customFields} />
    </SectionCard>
  );
}

function wantsCreatePanel(params: Record<string, string | string[] | undefined>) {
  return params.new === "1";
}

export default async function CustomersPage({
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
  const showCreatePanel = wantsCreatePanel(params);
  const pagination = crmPaginationFromSearchParams(params);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <p className="mt-1 text-sm text-slate-500">Customer details, addresses, and job history.</p>
      </div>

      <div className={showCreatePanel ? "grid gap-6 xl:grid-cols-[1.4fr_0.9fr]" : "space-y-6"}>
        <Suspense fallback={<SectionCard title="Customers"><p className="text-sm text-slate-500">Loading customers...</p></SectionCard>}>
          <CustomersClientPanel
            pagination={pagination}
            params={params}
            showCreatePanel={showCreatePanel}
            demoActive={demoState.active}
          />
        </Suspense>

        {showCreatePanel ? (
          <Suspense fallback={<SectionCard title="New Customer"><p className="text-sm text-slate-500">Loading form...</p></SectionCard>}>
            <CustomerCreatePanel />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}
