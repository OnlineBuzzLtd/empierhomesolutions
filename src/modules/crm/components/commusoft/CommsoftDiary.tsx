"use client";

import Link from "next/link";
import { useState } from "react";
import { jobStatusConfig } from "@/modules/crm/lib/status";
import { CommsoftBottomNav } from "@/modules/crm/components/commusoft/CommsoftHome";
import type { EngineerDashboardJob } from "@/modules/crm/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildDateStrip(centerDate: Date, count = 7) {
  const days: Date[] = [];
  const start = new Date(centerDate);
  start.setDate(start.getDate() - 2);
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function toLocalDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CommsoftDiary({ jobs }: { jobs: EngineerDashboardJob[] }) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(toLocalDateString(today));

  const strip = buildDateStrip(today);

  const jobsForDate = jobs.filter((job) => job.scheduled_date === selectedDate);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Diary</h1>
        </div>
        <div className="flex gap-2">
          <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
            List ▾
          </button>
        </div>
      </div>

      {/* Date strip */}
      <div className="flex gap-1 overflow-x-auto px-4 pb-4 scrollbar-hide">
        {strip.map((d) => {
          const ds = toLocalDateString(d);
          const isSelected = ds === selectedDate;
          const isToday = ds === toLocalDateString(today);
          return (
            <button
              key={ds}
              onClick={() => setSelectedDate(ds)}
              className={`flex min-w-[52px] flex-col items-center rounded-2xl px-3 py-2.5 transition-colors ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className={`text-base font-bold ${isSelected ? "text-white" : isToday ? "text-blue-600" : "text-slate-900"}`}>
                {d.getDate()}
              </span>
              <span className={`mt-0.5 text-xs ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                {DAY_LABELS[d.getDay()]}
              </span>
              {isToday && !isSelected ? (
                <span className="mt-1 h-1 w-1 rounded-full bg-blue-600" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Month label */}
      <div className="px-5 pb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {MONTH_LABELS[new Date(selectedDate).getMonth()]} {new Date(selectedDate).getFullYear()}
        </p>
      </div>

      {/* Job list */}
      <div className="flex-1 px-4">
        {jobsForDate.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 p-6 text-center">
            <p className="text-sm text-slate-500">No jobs scheduled for this day.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobsForDate.map((job) => (
              <DiaryJobRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      <CommsoftBottomNav active="diary" />
    </div>
  );
}

function DiaryJobRow({ job }: { job: EngineerDashboardJob }) {
  const address = [job.customer?.address_line1, job.customer?.postcode].filter(Boolean).join(", ");
  const statusCfg = jobStatusConfig[job.status];
  const statusLabel =
    job.status === "in_progress" ? "Travelling" : statusCfg?.label ?? job.status;
  const statusColor =
    job.status === "in_progress"
      ? "text-emerald-600"
      : job.status === "booked"
        ? "text-blue-600"
        : "text-slate-500";

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-2xl border border-l-4 border-slate-200 border-l-emerald-500 p-4 hover:bg-slate-50"
    >
      <p className="text-sm font-semibold text-slate-900 line-clamp-1">
        {job.title}
      </p>
      <p className="mt-0.5 text-sm text-slate-600">{job.customer?.full_name}</p>
      {address ? <p className="mt-0.5 text-xs text-slate-400">{address}</p> : null}
      <div className="mt-2 flex items-center gap-3">
        {job.scheduled_time ? (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <ClockIcon />
            {job.scheduled_time}
          </span>
        ) : null}
        <span className={`flex items-center gap-1 text-xs font-medium ${statusColor}`}>
          <TruckIcon />
          {statusLabel}
        </span>
      </div>
    </Link>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M1 3h8v6H1V3zM9 5h2.5L13 7.5V9H9V5z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="3.5" cy="10" r="1" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="10.5" cy="10" r="1" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
