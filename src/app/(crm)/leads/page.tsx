import { LeadCreateForm } from "@/modules/crm/components/forms/LeadCreateForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoEmptyMessage } from "@/modules/crm/lib/demo";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { formatRelativeTime } from "@/modules/crm/lib/format";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { leadStatusConfig } from "@/modules/crm/lib/status";
import { listCustomFieldDefinitions, listJobTypes, listLeads, listServices, listUserProfiles } from "@/modules/crm/lib/data";

export default async function LeadsPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const demoState = await getCrmDemoState();
  const [leads, services, jobTypes, users, customFields] = await Promise.all([
    listLeads(demoState.mode),
    listServices(),
    listJobTypes(),
    listUserProfiles(demoState.mode),
    listCustomFieldDefinitions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">{leads.length} leads tracked in the pipeline.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <SectionCard title="Lead Pipeline" demoAnchor="lead-pipeline">
          {leads.length === 0 ? (
            <EmptyState message={demoState.active ? getCrmDemoEmptyMessage("leads") : "No leads yet. Add the first lead using the form."} />
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => (
                <div key={lead.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{lead.customer?.full_name ?? "Unlinked lead"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {lead.source || "No source"} · {lead.service?.name || "Service TBC"} · {lead.job_type?.name || "Job type TBC"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Next action {formatRelativeTime(lead.next_action_at)}</p>
                    </div>
                    <StatusBadge config={leadStatusConfig[lead.status]} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Add Lead">
          <LeadCreateForm services={services} jobTypes={jobTypes} users={users} customFields={customFields} />
        </SectionCard>
      </div>
    </div>
  );
}
