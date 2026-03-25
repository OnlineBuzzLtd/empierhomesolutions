import Link from "next/link";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { formatDate } from "@/modules/crm/lib/format";
import { jobStatusConfig } from "@/modules/crm/lib/status";
import type { EngineerDashboardData, EngineerDashboardJob } from "@/modules/crm/types";
import { JobStatusActionButton } from "@/modules/crm/components/dashboard/JobStatusActionButton";

export function EngineerDashboard({ data, engineerName }: { data: EngineerDashboardData; engineerName: string }) {
  const nextJob = data.nextAssignedJob;
  const hasUpcomingFallback = Boolean(nextJob && data.readyJobs.length === 0 && data.todaysAssignedJobs.length === 0 && data.upcomingAssignedJobs[0]?.id === nextJob.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Field Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">My Day</h1>
        <p className="mt-1 text-sm text-slate-500">Only the jobs, calls, notes, and documents you need on site.</p>
      </div>

      <div className="sticky top-0 z-10 -mx-4 border-y border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
          <Link href="/dashboard" className="rounded-full border border-slate-200 px-3 py-2 text-slate-700">
            Dashboard
          </Link>
          <a href="#today-route" className="rounded-full border border-slate-200 px-3 py-2 text-slate-700">
            Today
          </a>
          <Link href="/jobs" className="rounded-full border border-slate-200 px-3 py-2 text-slate-700">
            Jobs
          </Link>
          {nextJob?.customer?.phone ? (
            <a href={`tel:${nextJob.customer.phone.replace(/\s+/g, "")}`} className="rounded-full bg-slate-900 px-3 py-2 text-white">
              Call
            </a>
          ) : (
            <Link href="/calendar" className="rounded-full border border-slate-200 px-3 py-2 text-slate-700">
              Calendar
            </Link>
          )}
        </div>
      </div>

      <DemoAnchor name="dashboard-overview">
        <section id="my-day" className="rounded-[28px] border border-slate-200 bg-[linear-gradient(145deg,rgba(255,255,255,1),rgba(241,245,249,0.92))] p-5 shadow-xl shadow-slate-200/70 lg:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-3">
                <p className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  Engineer
                </p>
                <p className="text-sm text-slate-500">{engineerName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next Job</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  {nextJob ? nextJob.title : "No active job queued"}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {nextJob
                    ? `${buildScheduleLabel(nextJob)} · ${nextJob.customer?.full_name ?? "Customer"} · ${nextJob.customer?.postcode ?? "Postcode pending"}`
                    : "No assigned jobs are due today. Use Jobs or Calendar to check upcoming work."}
                </p>
                {hasUpcomingFallback ? (
                  <p className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-800">
                    Upcoming job
                  </p>
                ) : null}
              </div>
              {nextJob ? (
                <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  <InfoPair label="Address" value={buildAddressLabel(nextJob)} />
                  <InfoPair label="Service" value={`${nextJob.service?.name ?? "Service not set"}${nextJob.job_type?.name ? ` · ${nextJob.job_type.name}` : ""}`} />
                  <InfoPair label="Contact" value={nextJob.customer?.phone ?? "Phone not set"} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
                    <div className="mt-2">
                      <StatusBadge config={jobStatusConfig[nextJob.status]} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="w-full max-w-md space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {nextJob?.customer?.phone ? (
                  <a
                    href={`tel:${nextJob.customer.phone.replace(/\s+/g, "")}`}
                    className="rounded-full bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Call Customer
                  </a>
                ) : null}
                {nextJob ? (
                  <a
                    href={buildDirectionsUrl(nextJob)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open Directions
                  </a>
                ) : null}
                {nextJob ? (
                  <>
                    <JobStatusActionButton
                      endpoint={`/api/crm/jobs/${nextJob.id}`}
                      status="in_progress"
                      label="Start Job"
                      className="rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    />
                    <JobStatusActionButton
                      endpoint={`/api/crm/jobs/${nextJob.id}`}
                      status="completed"
                      label="Mark Complete"
                      className="rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    />
                    <Link href={`/jobs/${nextJob.id}#job-attachments`} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Add Photo
                    </Link>
                    <Link href={`/jobs/${nextJob.id}#job-notes`} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Add Note
                    </Link>
                  </>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Outstanding Tasks</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <TaskCount label="Missing Notes" value={data.fieldTaskCounts.missingNotes} />
                  <TaskCount label="Missing Photos" value={data.fieldTaskCounts.missingPhotos} />
                  <TaskCount label="Missing Docs" value={data.fieldTaskCounts.missingRequiredDocuments} />
                  <TaskCount label="Overdue Jobs" value={data.fieldTaskCounts.overdueJobs} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </DemoAnchor>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Today’s Route" demoAnchor="job-record">
          <div id="today-route" className="space-y-3">
            {data.todaysAssignedJobs.length === 0 ? (
              <EmptyState
                message={
                  data.upcomingAssignedJobs.length > 0
                    ? `No jobs assigned for today yet. Next upcoming job: ${buildScheduleLabel(data.upcomingAssignedJobs[0])}.`
                    : "No jobs assigned for today yet."
                }
              />
            ) : (
              data.todaysAssignedJobs.map((job) => <RouteCard key={job.id} job={job} />)
            )}
          </div>
        </SectionCard>

        <SectionCard title="Site Info">
          {nextJob ? (
            <div className="space-y-4 text-sm text-slate-700">
              <InfoBlock label="Job Brief" value={nextJob.description || "No job brief or access note added yet."} />
              <InfoBlock label="Latest Note" value={nextJob.latestNote?.body || "No site notes recorded yet."} meta={nextJob.latestNote ? `Updated ${formatRelativeDate(nextJob.latestNote.created_at)}` : undefined} />
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoPair label="Attachments" value={`${nextJob.attachmentCount} file${nextJob.attachmentCount === 1 ? "" : "s"}`} />
                <InfoPair label="Commercial" value={buildCommercialLabel(nextJob)} />
              </div>
            </div>
          ) : (
            <EmptyState message="Your next job details will appear here when work is assigned." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Ready for Me">
          {data.readyJobs.length === 0 ? (
            <EmptyState message="Nothing due today or overdue. You are clear for now." />
          ) : (
            <div className="space-y-3">
              {data.readyJobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {buildScheduleLabel(job)} · {job.customer?.full_name ?? "Customer"} · {job.customer?.postcode ?? "Postcode pending"}
                      </p>
                    </div>
                    <StatusBadge config={jobStatusConfig[job.status]} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {job.overdue ? <TaskPill tone="rose" label="Overdue" /> : null}
                    {job.missingPhoto ? <TaskPill tone="amber" label="Photo needed" /> : null}
                    {job.missingNote ? <TaskPill tone="amber" label="Note needed" /> : null}
                    {job.missingRequiredDocument ? <TaskPill tone="rose" label="Document missing" /> : null}
                    {job.hasQuote ? <TaskPill tone="slate" label="Quote linked" /> : null}
                    {job.hasInvoice ? <TaskPill tone="slate" label="Invoice linked" /> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Outstanding Tasks">
          {data.readyJobs.filter((job) => job.overdue || job.missingNote || job.missingPhoto || job.missingRequiredDocument).length === 0 ? (
            <EmptyState message="No missing notes, photos, or required documents." />
          ) : (
            <div className="space-y-3">
              {data.readyJobs
                .filter((job) => job.overdue || job.missingNote || job.missingPhoto || job.missingRequiredDocument)
                .map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                    <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {job.customer?.full_name ?? "Customer"} · {job.customer?.postcode ?? "Postcode pending"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {job.overdue ? <TaskPill tone="rose" label="Missed slot" /> : null}
                      {job.missingNote ? <TaskPill tone="amber" label="Add a site note" /> : null}
                      {job.missingPhoto ? <TaskPill tone="amber" label="Upload a photo" /> : null}
                      {job.missingRequiredDocument ? <TaskPill tone="rose" label="Required document missing" /> : null}
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function RouteCard({ job }: { job: EngineerDashboardJob }) {
  return (
    <Link href={`/jobs/${job.id}`} className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{job.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {buildScheduleLabel(job)} · {job.customer?.full_name ?? "Customer"} · {job.customer?.postcode ?? "Postcode pending"}
          </p>
          <p className="mt-2 text-sm text-slate-600">{job.customer?.address_line1 ?? "Address not set"}</p>
        </div>
        <StatusBadge config={jobStatusConfig[job.status]} />
      </div>
    </Link>
  );
}

function TaskCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
    </div>
  );
}

function TaskPill({ label, tone }: { label: string; tone: "amber" | "rose" | "slate" }) {
  const styles =
    tone === "rose"
      ? "bg-rose-100 text-rose-700"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 font-medium ${styles}`}>{label}</span>;
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 leading-6 text-slate-800">{value}</p>
      {meta ? <p className="mt-2 text-xs text-slate-500">{meta}</p> : null}
    </div>
  );
}

function buildScheduleLabel(job: EngineerDashboardJob) {
  const date = job.scheduled_date ? formatDate(job.scheduled_date) : "Date TBC";
  const time = job.scheduled_time ?? "Time TBC";
  return `${date} · ${time}`;
}

function buildAddressLabel(job: EngineerDashboardJob) {
  return [job.customer?.address_line1, job.customer?.postcode].filter(Boolean).join(", ") || "Address not set";
}

function buildCommercialLabel(job: EngineerDashboardJob) {
  if (job.hasQuote && job.hasInvoice) {
    return "Quote and invoice linked";
  }
  if (job.hasQuote) {
    return "Quote linked";
  }
  if (job.hasInvoice) {
    return "Invoice linked";
  }
  return "No quote or invoice yet";
}

function buildDirectionsUrl(job: EngineerDashboardJob) {
  const destination = [job.customer?.address_line1, job.customer?.postcode].filter(Boolean).join(", ");
  const query = destination || `${job.customer?.full_name ?? "Job"} ${job.customer?.postcode ?? ""}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function formatRelativeDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
