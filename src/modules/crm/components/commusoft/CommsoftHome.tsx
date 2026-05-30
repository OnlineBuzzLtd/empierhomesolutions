import Link from "next/link";
import { CrmInstantLink } from "@/modules/crm/components/client/CrmClientRuntime";
import { formatDate } from "@/modules/crm/lib/format";
import type { EngineerDashboardData, EngineerDashboardJob } from "@/modules/crm/types";

export function CommsoftHome({ data, engineerName }: { data: EngineerDashboardData; engineerName: string }) {
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

      {/* Today */}
      <div className="flex-1 px-4">
        <p className="mb-3 text-sm text-slate-400">Today</p>

        {job ? (
          <CurrentEventCard job={job} />
        ) : (
          <div className="rounded-2xl border border-slate-200 p-6 text-center">
            <p className="text-sm text-slate-500">No jobs today.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CurrentEventCard({ job }: { job: EngineerDashboardJob }) {
  const address = [job.site?.address_line1 ?? job.customer?.address_line1, job.site?.postcode ?? job.customer?.postcode]
    .filter(Boolean)
    .join(", ");
  const directionsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <article className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {job.scheduled_time || "Time to confirm"}
          </p>
          <Link href={`/jobs/${job.id}`} className="mt-1 block text-base font-semibold leading-snug text-slate-900">
            {job.customer?.full_name ?? "Customer to confirm"}
          </Link>
        </div>
        <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
          #{job.id.slice(0, 6).toUpperCase()}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-800">{job.title}</p>
      {address ? <p className="mt-1 text-sm leading-5 text-slate-600">{address}</p> : null}
      {job.scheduled_date ? (
        <p className="mt-2 text-xs text-slate-400">
          {formatDate(job.scheduled_date)}
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
        {job.customer?.phone ? (
          <a href={`tel:${job.customer.phone}`} className="rounded-full bg-blue-600 px-3 py-2 text-white">
            Phone
          </a>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-400">Phone</span>
        )}
        {directionsUrl ? (
          <a href={directionsUrl} target="_blank" rel="noreferrer" className="rounded-full bg-slate-900 px-3 py-2 text-white">
            Directions
          </a>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-400">Directions</span>
        )}
        <Link href={`/jobs/${job.id}`} className="rounded-full border border-slate-200 px-3 py-2 text-slate-700">
          Open
        </Link>
      </div>
    </article>
  );
}

export type CommsoftBottomNavActive = "today" | "diary" | "jobs" | "profile";

export function CommsoftBottomNav({ active }: { active: CommsoftBottomNavActive }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="grid grid-cols-4">
        <BottomNavItem href="/dashboard" label="Today" active={active === "today"}>
          <HomeIcon />
        </BottomNavItem>
        <BottomNavItem href="/diary" label="Diary" active={active === "diary"}>
          <DiaryIcon />
        </BottomNavItem>
        <BottomNavItem href="/jobs" label="Jobs" active={active === "jobs"}>
          <SearchIcon />
        </BottomNavItem>
        <BottomNavItem href="/preferences" label="Profile" active={active === "profile"}>
          <ViewIcon />
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
    <CrmInstantLink
      href={href}
      className={`flex flex-col items-center gap-1 px-4 py-3 text-xs font-medium transition-colors ${
        active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {children}
      {label}
    </CrmInstantLink>
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

function ViewIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 20h8M11 17v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 8h8M7 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
