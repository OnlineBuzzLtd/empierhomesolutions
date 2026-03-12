import { AppointmentCreateForm } from "@/modules/crm/components/forms/AppointmentCreateForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { formatDateTime } from "@/modules/crm/lib/format";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { listAppointmentsForCalendar, listCustomers, listLeads, listUserProfiles } from "@/modules/crm/lib/data";

export default async function CalendarPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const [appointments, customers, leads, users] = await Promise.all([
    listAppointmentsForCalendar(),
    listCustomers(),
    listLeads(),
    listUserProfiles(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <p className="mt-1 text-sm text-slate-500">Calls, surveys, bookings, and reminders for the next 7 days.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <SectionCard title="Upcoming Items">
          {appointments.length === 0 ? (
            <EmptyState message="No appointments scheduled in the next week." />
          ) : (
            <ul className="space-y-3">
              {appointments.map((appointment) => (
                <li key={appointment.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">{appointment.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{appointment.type}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(appointment.starts_at)} → {formatDateTime(appointment.ends_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Add Calendar Item">
          <AppointmentCreateForm customers={customers} leads={leads} users={users} />
        </SectionCard>
      </div>
    </div>
  );
}
