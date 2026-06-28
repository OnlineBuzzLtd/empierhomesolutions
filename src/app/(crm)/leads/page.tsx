import { Suspense } from "react";
import { LeadsClientPanel } from "@/modules/crm/components/client/CrmHotListPanels";
import { LeadCreateForm } from "@/modules/crm/components/forms/LeadCreateForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { listCustomFieldDefinitions, listCustomers, listJobTypes, listServices, listUserProfiles } from "@/modules/crm/lib/data";
import { crmPaginationFromSearchParams } from "@/modules/crm/lib/performance";
import type { CrmMode } from "@/modules/crm/lib/demo";

async function LeadCreatePanel({ mode, successRedirectHref }: { mode: CrmMode; successRedirectHref: string }) {
  const [customers, services, jobTypes, users, customFields] = await Promise.all([
    listCustomers(mode, { pageSize: 250 }),
    listServices(),
    listJobTypes(),
    listUserProfiles(mode),
    listCustomFieldDefinitions(),
  ]);

  return (
    <LeadCreateForm
      customers={customers}
      services={services}
      jobTypes={jobTypes}
      users={users}
      customFields={customFields}
      successRedirectHref={successRedirectHref}
    />
  );
}

function wantsCreatePanel(params: Record<string, string | string[] | undefined>) {
  return params.new === "1";
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseLeadTab(params: Record<string, string | string[] | undefined>) {
  const tab = firstParam(params.tab);
  return tab === "done" || tab === "all" ? tab : "todo";
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
  const activeTab = parseLeadTab(params);
  const closeCreateHref = `/leads?tab=${activeTab}`;
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

      <div className="space-y-6">
        <Suspense fallback={<SectionCard title="Enquiries"><p className="text-sm text-slate-500">Loading enquiries...</p></SectionCard>}>
          <LeadsClientPanel
            pagination={pagination}
            params={params}
            showCreatePanel={showCreatePanel}
          />
        </Suspense>

        {showCreatePanel ? (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6" role="dialog" aria-modal="true" aria-labelledby="new-enquiry-title">
            <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 id="new-enquiry-title" className="text-lg font-semibold text-slate-950">New enquiry</h2>
                  <p className="mt-1 text-sm text-slate-500">Capture the phone note first. Add CRM details only if you have them.</p>
                </div>
                <a href={closeCreateHref} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </a>
              </div>
              <div className="px-5 py-5">
                <Suspense fallback={<p className="text-sm text-slate-500">Loading form...</p>}>
                  <LeadCreatePanel mode={demoState.mode} successRedirectHref={closeCreateHref} />
                </Suspense>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
