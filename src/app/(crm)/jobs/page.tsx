import Link from "next/link";
import { JobCreateForm } from "@/modules/crm/components/forms/JobCreateForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { listCustomers, listCustomFieldDefinitions, listJobs, listJobTypes, listServices } from "@/modules/crm/lib/data";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { jobStatusConfig } from "@/modules/crm/lib/status";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";

export default async function JobsPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const [jobs, customers, services, jobTypes, customFields] = await Promise.all([
    listJobs(),
    listCustomers(),
    listServices(),
    listJobTypes(),
    listCustomFieldDefinitions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
        <p className="mt-1 text-sm text-slate-500">{jobs.length} jobs across all pipeline stages.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <SectionCard title="Job List">
          {jobs.length === 0 ? (
            <EmptyState message="No jobs yet. Create the first job from the form." />
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {jobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-start justify-between gap-4 px-4 py-4 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {job.customer?.full_name ?? "Customer"} · {job.service?.name ?? "Service"} · {job.scheduled_date ?? "TBC"}
                    </p>
                  </div>
                  <StatusBadge config={jobStatusConfig[job.status]} />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Add Job">
          <JobCreateForm customers={customers} services={services} jobTypes={jobTypes} customFields={customFields} />
        </SectionCard>
      </div>
    </div>
  );
}
