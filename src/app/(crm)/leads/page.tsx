import Link from "next/link";
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
import type { LeadWithRelations } from "@/modules/crm/types";
import { listCustomFieldDefinitions, listJobTypes, listLeads, listServices, listUserProfiles } from "@/modules/crm/lib/data";

function intakeBadge(lead: LeadWithRelations) {
  if (lead.customer_match_result === "possible_duplicate") {
    return {
      label: "Possible duplicate",
      className: "bg-amber-100 text-amber-800",
    };
  }

  if (lead.customer_match_result === "matched") {
    return {
      label: "Matched existing customer",
      className: "bg-slate-100 text-slate-700",
    };
  }

  if (lead.customer_match_result === "new") {
    return {
      label: "New customer created",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  return null;
}

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
              {leads.map((lead) => {
                const badge = intakeBadge(lead);

                return (
                  <div key={lead.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{lead.customer?.full_name ?? "Unlinked lead"}</p>
                          {lead.customer?.id ? (
                            <Link href={`/customers/${lead.customer.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                              Open customer
                            </Link>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {lead.source || "No source"} · {lead.service?.name || "Service TBC"} · {lead.job_type?.name || "Job type TBC"}
                        </p>
                        {lead.customer ? (
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            {lead.customer.phone ? <p>Phone: {lead.customer.phone}</p> : null}
                            {lead.customer.email ? <p>Email: {lead.customer.email}</p> : null}
                            {lead.customer.address_line1 || lead.customer.postcode ? (
                              <p>
                                Address: {[lead.customer.address_line1, lead.customer.postcode].filter(Boolean).join(", ")}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {badge ? (
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
                          ) : null}
                          {lead.intake_source === "website" ? (
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                              Website intake
                            </span>
                          ) : null}
                          {lead.dedupe_result === "updated_existing" ? (
                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-700">
                              Repeat submit merged · {lead.submission_count} submissions
                            </span>
                          ) : lead.submission_count > 1 ? (
                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-700">
                              {lead.submission_count} submissions
                            </span>
                          ) : null}
                        </div>
                        {lead.customer_match_result === "matched" ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Existing customer history was matched safely. Historical customer attachments stay on the customer record.
                          </p>
                        ) : null}
                        {lead.possible_duplicate_customer ? (
                          <p className="mt-2 text-xs text-amber-700">
                            Similar customer found: {lead.possible_duplicate_customer.full_name || "Existing customer"}. Review before
                            merging records or carrying history across.
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500">Next action {formatRelativeTime(lead.next_action_at)}</p>
                      </div>
                      <StatusBadge config={leadStatusConfig[lead.status]} />
                    </div>
                  </div>
                );
              })}
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
