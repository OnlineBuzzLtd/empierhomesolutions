import { Suspense } from "react";
import { LeadsClientPanel } from "@/modules/crm/components/client/CrmHotListPanels";
import { LeadCreateForm } from "@/modules/crm/components/forms/LeadCreateForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { listCustomFieldDefinitions, listJobTypes, listServices, listUserProfiles } from "@/modules/crm/lib/data";
import { crmPaginationFromSearchParams } from "@/modules/crm/lib/performance";
import type { CrmMode } from "@/modules/crm/lib/demo";

async function LeadCreatePanel({ mode }: { mode: CrmMode }) {
  const [services, jobTypes, users, customFields] = await Promise.all([
    listServices(),
    listJobTypes(),
    listUserProfiles(mode),
    listCustomFieldDefinitions(),
  ]);

  return (
    <SectionCard title="New Enquiry">
      <LeadCreateForm services={services} jobTypes={jobTypes} users={users} customFields={customFields} />
    </SectionCard>
  );
}

function wantsCreatePanel(params: Record<string, string | string[] | undefined>) {
  return params.new === "1";
}

export default async function LeadsPage({
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
        <h1 className="text-2xl font-bold text-slate-900">Enquiries</h1>
        <p className="mt-1 text-sm text-slate-500">Customer requests that need a reply, quote, or job booking.</p>
        <p className="mt-1 text-xs text-slate-500">
          An enquiry is a customer request that still needs office action: call back, qualify, quote, or turn into a job.
        </p>
      </div>

      <div className={showCreatePanel ? "grid gap-6 xl:grid-cols-[1.4fr_0.9fr]" : "space-y-6"}>
        <Suspense fallback={<SectionCard title="Enquiries"><p className="text-sm text-slate-500">Loading enquiries...</p></SectionCard>}>
          <LeadsClientPanel
            pagination={pagination}
            params={params}
            showCreatePanel={showCreatePanel}
          />
        </Suspense>

        {showCreatePanel ? (
          <Suspense fallback={<SectionCard title="New Enquiry"><p className="text-sm text-slate-500">Loading form...</p></SectionCard>}>
            <LeadCreatePanel mode={demoState.mode} />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}
