import { Suspense } from "react";
import { getUiPreference } from "@/app/actions/ui-preference";
import { JobsClientPanel } from "@/modules/crm/components/client/CrmHotListPanels";
import { CommsoftJobSearch } from "@/modules/crm/components/commusoft/CommsoftJobSearch";
import { JobCreateForm } from "@/modules/crm/components/forms/JobCreateForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import {
  getEngineerDashboardData,
  listCustomers,
  listCustomFieldDefinitions,
  listJobTypes,
  listServices,
  listSiteContacts,
  listSites,
  listStaffDirectory,
} from "@/modules/crm/lib/data";
import { crmPaginationFromSearchParams } from "@/modules/crm/lib/performance";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { getAssignableEngineerOptions } from "@/modules/crm/lib/staff";
import type { EngineerDashboardData, EngineerDashboardJob } from "@/modules/crm/types";
import type { CrmMode } from "@/modules/crm/lib/demo";

function buildCommsoftSearchJobs(data: EngineerDashboardData): EngineerDashboardJob[] {
  const jobs = [
    data.nextAssignedJob,
    ...data.readyJobs,
    ...data.todaysAssignedJobs,
    ...data.overdueAssignedJobs,
    ...data.upcomingAssignedJobs,
    ...data.completedAssignedJobs,
  ].filter(Boolean) as EngineerDashboardJob[];

  return Array.from(new Map(jobs.map((job) => [job.id, job])).values());
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function wantsCreatePanel(params: Record<string, string | string[] | undefined>) {
  return getSingleParam(params.new) === "1";
}

async function JobCreatePanel({
  mode,
  requestedCustomerId,
  requestedSiteId,
  requestedSiteContactId,
}: {
  mode: CrmMode;
  requestedCustomerId: string | null;
  requestedSiteId: string | null;
  requestedSiteContactId: string | null;
}) {
  const [customers, services, jobTypes, customFields, staff, sites, siteContacts] = await Promise.all([
    listCustomers(mode, { pageSize: 100 }),
    listServices(),
    listJobTypes(),
    listCustomFieldDefinitions(),
    listStaffDirectory(mode),
    listSites(mode),
    listSiteContacts(mode),
  ]);
  const engineers = getAssignableEngineerOptions(staff);
  const defaultCustomerId =
    requestedCustomerId && customers.some((customer) => customer.id === requestedCustomerId)
      ? requestedCustomerId
      : "";
  const defaultSiteId =
    requestedSiteId &&
    sites.some(
      (site) => site.id === requestedSiteId && (!defaultCustomerId || site.customer_id === defaultCustomerId),
    )
      ? requestedSiteId
      : "";
  const defaultSiteContactId =
    requestedSiteContactId &&
    siteContacts.some(
      (contact) =>
        contact.id === requestedSiteContactId &&
        (!defaultSiteId || contact.site_id === defaultSiteId) &&
        (!defaultCustomerId || contact.site?.customer_id === defaultCustomerId),
    )
      ? requestedSiteContactId
      : "";

  return (
    <SectionCard title="New Job">
      <JobCreateForm
        customers={customers}
        services={services}
        jobTypes={jobTypes}
        sites={sites}
        siteContacts={siteContacts}
        engineers={engineers}
        customFields={customFields}
        defaultCustomerId={defaultCustomerId}
        defaultSiteId={defaultSiteId}
        defaultSiteContactId={defaultSiteContactId}
      />
    </SectionCard>
  );
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireCrmUser();
  const demoState = await getCrmDemoState();

  if (session.profile?.role === "engineer") {
    const uiMode = await getUiPreference();
    if (uiMode === "commusoft") {
      const data = await getEngineerDashboardData(session.profile.full_name, demoState.mode);
      return <CommsoftJobSearch jobs={buildCommsoftSearchJobs(data)} />;
    }
  }

  const params = await searchParams;
  const requestedCustomerId = getSingleParam(params.customer);
  const requestedSiteId = getSingleParam(params.site);
  const requestedSiteContactId = getSingleParam(params.siteContact);
  const showCreatePanel = wantsCreatePanel(params) || Boolean(requestedCustomerId || requestedSiteId || requestedSiteContactId);
  const pagination = crmPaginationFromSearchParams(params);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
        <p className="mt-1 text-sm text-slate-500">Create work, assign engineers, and keep jobs moving.</p>
      </div>

      <div className={showCreatePanel ? "grid gap-6 xl:grid-cols-[1.4fr_0.9fr]" : "space-y-6"}>
        <Suspense fallback={<SectionCard title="Jobs"><p className="text-sm text-slate-500">Loading jobs...</p></SectionCard>}>
          <JobsClientPanel
            pagination={pagination}
            params={params}
            showCreatePanel={showCreatePanel}
            demoActive={demoState.active}
          />
        </Suspense>

        {showCreatePanel ? (
          <Suspense fallback={<SectionCard title="New Job"><p className="text-sm text-slate-500">Loading form...</p></SectionCard>}>
            <JobCreatePanel
              mode={demoState.mode}
              requestedCustomerId={requestedCustomerId}
              requestedSiteId={requestedSiteId}
              requestedSiteContactId={requestedSiteContactId}
            />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}
