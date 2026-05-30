import { Suspense } from "react";
import Link from "next/link";
import { AppointmentCreateForm } from "@/modules/crm/components/forms/AppointmentCreateForm";
import { CalendarWeekClientPanel } from "@/modules/crm/components/client/CrmFastScreenPanels";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import {
  DEFAULT_TIMEZONE,
  getWeekRange,
  parseWeekAnchor,
  shiftWeek,
} from "@/modules/crm/lib/calendar-layout";
import {
  listCustomers,
  listLeads,
  listUserProfiles,
} from "@/modules/crm/lib/data";

export default async function CalendarPage({
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
  const type = typeof params.type === "string" ? params.type : null;
  const status = typeof params.status === "string" ? params.status : null;
  const assignedTo = typeof params.assigned_to === "string" ? params.assigned_to : null;
  const weekParam = typeof params.week === "string" ? params.week : null;

  // Compute the Monday-anchored week the user is viewing. parseWeekAnchor
  // returns null for missing/malformed values → default to current week.
  const weekReference = parseWeekAnchor(weekParam) ?? new Date();
  const week = getWeekRange(weekReference, DEFAULT_TIMEZONE);
  const weekStartDate = new Date(week.startIso);

  // Prev / next / today week links — preserve other filters.
  const prevHref = buildWeekHref({
    type,
    status,
    assignedTo,
    week: ymd(shiftWeek(weekReference, -1)),
  });
  const nextHref = buildWeekHref({
    type,
    status,
    assignedTo,
    week: ymd(shiftWeek(weekReference, 1)),
  });
  const todayHref = buildWeekHref({ type, status, assignedTo, week: null });

  // Week-label header.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULT_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const weekLabel = `${fmt.format(weekStartDate)} – ${fmt.format(new Date(week.days[6]!.utcMidnightIso))}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scheduler</h1>
          <p className="mt-1 text-sm text-slate-500">
            Book jobs, check engineer availability, and see the week at a glance.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/calendar" className="rounded-full bg-slate-900 px-3 py-1.5 font-medium text-white">
          Week
        </Link>
        <Link
          href="/calendar/availability"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
        >
          Availability
        </Link>
        <Link
          href="/calendar/schedule"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
        >
          Schedule
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <CalendarWeekClientPanel
          apiUrl={buildCalendarApiUrl({ type, status, assignedTo, week: weekParam })}
          type={type}
          status={status}
          assignedTo={assignedTo}
          weekParam={weekParam}
          weekReferenceIso={weekReference.toISOString()}
          weekLabel={weekLabel}
          prevHref={prevHref}
          nextHref={nextHref}
          todayHref={todayHref}
          demoActive={demoState.active}
        />

        <Suspense fallback={<SectionCard title="New Appointment"><p className="text-sm text-slate-500">Loading form...</p></SectionCard>}>
          <CalendarCreatePanel mode={demoState.mode} />
        </Suspense>
      </div>
    </div>
  );
}

async function CalendarCreatePanel({
  mode,
}: {
  mode: Awaited<ReturnType<typeof getCrmDemoState>>["mode"];
}) {
  const [customers, leads, users] = await Promise.all([
    listCustomers(mode, { pageSize: 100 }),
    listLeads(mode, { pageSize: 100 }),
    listUserProfiles(mode),
  ]);

  return (
    <SectionCard title="New Appointment">
      <AppointmentCreateForm customers={customers} leads={leads} users={users} />
    </SectionCard>
  );
}

function buildFilterQuery(filters: {
  type: string | null;
  status: string | null;
  assignedTo: string | null;
  week?: string | null;
}) {
  const search = new URLSearchParams();
  if (filters.type) search.set("type", filters.type);
  if (filters.status) search.set("status", filters.status);
  if (filters.assignedTo) search.set("assigned_to", filters.assignedTo);
  if (filters.week) search.set("week", filters.week);
  const value = search.toString();
  return value ? `?${value}` : "";
}

function buildWeekHref(filters: {
  type: string | null;
  status: string | null;
  assignedTo: string | null;
  week: string | null;
}) {
  return `/calendar${buildFilterQuery(filters)}`;
}

function buildCalendarApiUrl(filters: {
  type: string | null;
  status: string | null;
  assignedTo: string | null;
  week?: string | null;
}) {
  return `/api/crm/calendar/week${buildFilterQuery(filters)}`;
}

function ymd(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
