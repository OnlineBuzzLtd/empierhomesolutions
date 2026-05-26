"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate } from "@/modules/crm/lib/format";
import { jobStatusConfig } from "@/modules/crm/lib/status";
import type { EngineerDashboardJob } from "@/modules/crm/types";

type Props = {
  jobs: EngineerDashboardJob[];
};

export function CommsoftJobSearch({ jobs }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredJobs = useMemo(() => {
    if (!normalizedQuery) {
      return jobs;
    }

    return jobs.filter((job) => {
      const haystack = [
        job.title,
        job.customer?.full_name,
        job.customer?.postcode,
        job.customer?.address_line1,
        job.site?.label,
        job.site?.address_line1,
        job.site?.postcode,
        job.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [jobs, normalizedQuery]);

  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 pt-10 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Engineer</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Search jobs</h1>
        <p className="mt-1 text-sm text-slate-500">Find assigned, upcoming, and recently completed work.</p>
      </div>

      <div className="px-4 pb-4">
        <label className="block">
          <span className="sr-only">Search assigned jobs</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by customer, postcode, job, status"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </label>
      </div>

      <div className="space-y-3 px-4">
        {filteredJobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">No jobs found.</p>
            <p className="mt-1 text-xs text-slate-500">Try a customer name, postcode, or status.</p>
          </div>
        ) : (
          filteredJobs.map((job) => <CommsoftSearchJobCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}

function CommsoftSearchJobCard({ job }: { job: EngineerDashboardJob }) {
  const address = [
    job.site?.address_line1 ?? job.customer?.address_line1,
    job.site?.postcode ?? job.customer?.postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const statusLabel = jobStatusConfig[job.status]?.label ?? job.status;
  const isComplete = ["completed", "invoiced", "no_access", "aborted"].includes(job.status);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{job.title}</p>
          <p className="mt-1 text-sm text-slate-600">{job.customer?.full_name ?? "Customer not set"}</p>
          {address ? <p className="mt-0.5 text-xs text-slate-400">{address}</p> : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isComplete ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {job.scheduled_date ? <span>{formatDate(job.scheduled_date)}</span> : <span>Date TBC</span>}
        {job.scheduled_time ? <span>{job.scheduled_time}</span> : null}
        {job.overdue ? <span className="font-semibold text-rose-600">Overdue</span> : null}
        {job.missingPhoto ? <span>Photo needed</span> : null}
      </div>
    </Link>
  );
}
