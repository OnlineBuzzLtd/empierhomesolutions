import Link from "next/link";
import { AppointmentCreateForm } from "@/modules/crm/components/forms/AppointmentCreateForm";
import { WeekTimeline } from "@/modules/crm/components/calendar/WeekTimeline";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoEmptyMessage } from "@/modules/crm/lib/demo";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { appointmentStatuses, appointmentTypes } from "@/modules/crm/types";
import {
  DEFAULT_TIMEZONE,
  getWeekRange,
  parseWeekAnchor,
  shiftWeek,
} from "@/modules/crm/lib/calendar-layout";
import {
  listAppointmentsForCalendar,
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

  const [appointments, customers, leads, users] = await Promise.all([
    listAppointmentsForCalendar({
      type,
      status,
      assignedTo,
      mode: demoState.mode,
      from: weekStartDate,
      days: 7,
    }),
    listCustomers(demoState.mode),
    listLeads(demoState.mode),
    listUserProfiles(demoState.mode),
  ]);

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
          <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Week timeline for calls, surveys, bookings, recurring reminders, service due dates, and warranty expiries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <FilterLink href="/calendar" active={!type && !status && !assignedTo} label="All items" />
          {appointmentTypes.map((value) => (
            <FilterLink
              key={value}
              href={`/calendar?type=${value}`}
              active={type === value}
              label={value.replaceAll("_", " ")}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/calendar" className="rounded-full bg-slate-900 px-3 py-1.5 font-medium text-white">
          Week view
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
          Dispatch board
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <SectionCard
          title="Week timeline"
          demoAnchor="calendar-schedule"
          action={
            <div className="flex items-center gap-2 text-xs">
              <Link
                href={prevHref}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                aria-label="Previous week"
              >
                ←
              </Link>
              <Link
                href={todayHref}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                Today
              </Link>
              <Link
                href={nextHref}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                aria-label="Next week"
              >
                →
              </Link>
              <span className="ml-2 text-slate-600">{weekLabel}</span>
            </div>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {appointmentStatuses.map((value) => (
              <FilterLink
                key={value}
                href={`/calendar${buildFilterQuery({ type, assignedTo, status: value, week: weekParam })}`}
                active={status === value}
                label={value}
              />
            ))}
            {users.map((user) => (
              <FilterLink
                key={user.user_id}
                href={`/calendar${buildFilterQuery({ type, status, assignedTo: user.user_id, week: weekParam })}`}
                active={assignedTo === user.user_id}
                label={user.full_name}
              />
            ))}
          </div>

          <WeekTimeline
            appointments={appointments}
            weekReferenceIso={weekReference.toISOString()}
          />

          {appointments.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                message={
                  demoState.active
                    ? getCrmDemoEmptyMessage("calendar items")
                    : "No items in this week — use the prev / next arrows to browse other weeks or add one on the right."
                }
              />
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Add Calendar Item">
          <AppointmentCreateForm customers={customers} leads={leads} users={users} />
        </SectionCard>
      </div>
    </div>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 font-medium capitalize ${
        active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
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

function ymd(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
