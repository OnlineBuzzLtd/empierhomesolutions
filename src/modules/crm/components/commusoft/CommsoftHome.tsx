import Link from "next/link";
import { formatDate } from "@/modules/crm/lib/format";
import type { EngineerDashboardData, EngineerDashboardJob } from "@/modules/crm/types";

export function CommsoftHome({
  data,
  engineerName,
}: {
  data: EngineerDashboardData;
  engineerName: string;
}) {
  const job = data.nextAssignedJob;
  const initials = engineerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="px-5 pt-10 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500 text-sm font-bold text-white">
              {initials}
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Hi {engineerName.split(" ")[0]}</h1>
          </div>
          <Link
            href="/preferences"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            title="View preferences"
          >
            <SettingsIcon />
          </Link>
        </div>
      </div>

      {/* Current event */}
      <div className="flex-1 px-4">
        <p className="mb-3 text-sm text-slate-400">Current event</p>

        {job ? (
          <CurrentEventCard job={job} />
        ) : (
          <div className="rounded-2xl border border-slate-200 p-6 text-center">
            <p className="text-sm text-slate-500">No jobs assigned for today.</p>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <CommsoftBottomNav active="home" />
    </div>
  );
}

function CurrentEventCard({ job }: { job: EngineerDashboardJob }) {
  const address = [job.customer?.address_line1, job.customer?.postcode].filter(Boolean).join(", ");

  return (
    <Link href={`/jobs/${job.id}`} className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-slate-800">{job.title}</p>
        <span className="flex-shrink-0 text-xs text-slate-400">
          #{job.id.slice(0, 6).toUpperCase()}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900">{job.customer?.full_name}</p>
      {address ? <p className="mt-0.5 text-sm text-slate-500">{address}</p> : null}
      {job.scheduled_date ? (
        <p className="mt-1 text-xs text-slate-400">
          {formatDate(job.scheduled_date)}
          {job.scheduled_time ? ` · ${job.scheduled_time}` : ""}
        </p>
      ) : null}
    </Link>
  );
}

export function CommsoftBottomNav({ active }: { active: "home" | "diary" | "search" }) {
  return (
    <nav className="sticky bottom-0 border-t border-slate-200 bg-white">
      <div className="grid grid-cols-3">
        <BottomNavItem href="/dashboard" label="Home" active={active === "home"}>
          <HomeIcon />
        </BottomNavItem>
        <BottomNavItem href="/diary" label="Diary" active={active === "diary"}>
          <DiaryIcon />
        </BottomNavItem>
        <BottomNavItem href="/jobs" label="Search" active={active === "search"}>
          <SearchIcon />
        </BottomNavItem>
      </div>
    </nav>
  );
}

function BottomNavItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 px-4 py-3 text-xs font-medium transition-colors ${
        active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {children}
      {label}
    </Link>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M3 9.5L11 3l8 6.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 20V13h6v7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function DiaryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h16M8 2v4M14 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 15l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M9 1.5v1.5M9 15v1.5M1.5 9H3M15 9h1.5M3.4 3.4l1.1 1.1M13.5 13.5l1.1 1.1M3.4 14.6l1.1-1.1M13.5 4.5l1.1-1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
