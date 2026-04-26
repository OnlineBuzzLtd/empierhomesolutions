import Link from "next/link";
import { format } from "date-fns";
import { AppointmentCreateForm } from "@/modules/crm/components/forms/AppointmentCreateForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoEmptyMessage } from "@/modules/crm/lib/demo";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { formatDateTime } from "@/modules/crm/lib/format";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { appointmentStatuses, appointmentTypes } from "@/modules/crm/types";
import { listAppointmentsForCalendar, listCustomers, listLeads, listUserProfiles } from "@/modules/crm/lib/data";

const appointmentStatusConfig = {
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700" },
} as const;

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

  const [appointments, customers, leads, users] = await Promise.all([
    listAppointmentsForCalendar({ type, status, assignedTo, mode: demoState.mode }),
    listCustomers(demoState.mode),
    listLeads(demoState.mode),
    listUserProfiles(demoState.mode),
  ]);

  const grouped = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const dayKey = appointment.starts_at.slice(0, 10);
    const current = grouped.get(dayKey) ?? [];
    current.push(appointment);
    grouped.set(dayKey, current);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">Week view for calls, surveys, bookings, recurring reminders, service due dates, and warranty expiries.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <FilterLink href="/calendar" active={!type && !status && !assignedTo} label="All items" />
          {appointmentTypes.map((value) => (
            <FilterLink key={value} href={`/calendar?type=${value}`} active={type === value} label={value.replaceAll("_", " ")} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href="/calendar"
          className="rounded-full bg-slate-900 px-3 py-1.5 font-medium text-white"
        >
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
        <SectionCard title="Upcoming Schedule" demoAnchor="calendar-schedule">
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {appointmentStatuses.map((value) => (
              <FilterLink
                key={value}
                href={`/calendar${buildFilterQuery({ type, assignedTo, status: value })}`}
                active={status === value}
                label={value}
              />
            ))}
            {users.map((user) => (
              <FilterLink
                key={user.user_id}
                href={`/calendar${buildFilterQuery({ type, status, assignedTo: user.user_id })}`}
                active={assignedTo === user.user_id}
                label={user.full_name}
              />
            ))}
          </div>

          {appointments.length === 0 ? (
            <EmptyState message={demoState.active ? getCrmDemoEmptyMessage("calendar items") : "No calendar items match the current filters."} />
          ) : (
            <div className="space-y-5">
              {Array.from(grouped.entries()).map(([day, items]) => (
                <div key={day} className="space-y-3">
                  <div className="sticky top-0 z-10 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {format(new Date(`${day}T00:00:00`), "EEEE dd MMM yyyy")}
                  </div>
                  <div className="space-y-3">
                    {items.map((appointment) => (
                      <div key={appointment.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">{appointment.title}</p>
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              {appointment.type.replaceAll("_", " ")} · {appointment.source.replaceAll("_", " ")}
                            </p>
                            <p className="text-xs text-slate-500">{formatDateTime(appointment.starts_at)} → {formatDateTime(appointment.ends_at)}</p>
                            <p className="text-xs text-slate-500">
                              {appointment.customer?.full_name ?? "No customer"} · {appointment.owner?.full_name ?? "Unassigned"}
                            </p>
                            {appointment.recurrence_rule ? (
                              <p className="text-xs text-slate-500">Repeats {appointment.recurrence_rule}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge config={appointmentStatusConfig[appointment.status]} />
                            {appointment.entity_link ? (
                              <Link href={appointment.entity_link} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                                Open
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
      className={`rounded-full px-3 py-1.5 font-medium capitalize ${active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      {label}
    </Link>
  );
}

function buildFilterQuery(filters: { type: string | null; status: string | null; assignedTo: string | null }) {
  const search = new URLSearchParams();
  if (filters.type) {
    search.set("type", filters.type);
  }
  if (filters.status) {
    search.set("status", filters.status);
  }
  if (filters.assignedTo) {
    search.set("assigned_to", filters.assignedTo);
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}
