import type { Customer, Lead, UserProfile } from "@/modules/crm/types";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";

export function AppointmentCreateForm({
  customers,
  leads,
  users,
}: {
  customers: Customer[];
  leads: Lead[];
  users: UserProfile[];
}) {
  return (
    <ApiForm endpoint="/api/crm/appointments" submitLabel="Add Calendar Item" className="grid gap-3 md:grid-cols-2">
      <select name="type" defaultValue="call" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="call">Call</option>
        <option value="follow_up">Follow Up</option>
        <option value="survey">Survey</option>
        <option value="booking">Booking</option>
        <option value="meeting">Meeting</option>
        <option value="reminder">Reminder</option>
      </select>
      <input name="title" required placeholder="Title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <select name="customer_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="">No customer</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.full_name}
          </option>
        ))}
      </select>
      <select name="lead_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="">No lead</option>
        {leads.map((lead) => (
          <option key={lead.id} value={lead.id}>
            {lead.status} · {lead.source || "Lead"}
          </option>
        ))}
      </select>
      <select name="assigned_to" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="">Unassigned</option>
        {users.map((user) => (
          <option key={user.user_id} value={user.user_id}>
            {user.full_name}
          </option>
        ))}
      </select>
      <select name="status" defaultValue="scheduled" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="scheduled">Scheduled</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select name="recurrence_rule" defaultValue="" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>
      <input name="starts_at" type="datetime-local" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="ends_at" type="datetime-local" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="reminder_offset_minutes" type="number" min="0" placeholder="Reminder minutes before" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
    </ApiForm>
  );
}
