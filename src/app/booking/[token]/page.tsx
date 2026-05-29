import { notFound } from "next/navigation";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { getAppointmentForSelfServiceToken } from "@/modules/crm/lib/self-service-booking";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function BookingSelfServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await params;
  const { status } = await searchParams;
  const resolved = await getAppointmentForSelfServiceToken(createCrmServiceRoleClient(), token);
  if (!resolved) {
    notFound();
  }
  const { appointment } = resolved;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Booking</p>
        <h1 className="mt-2 text-2xl font-bold">{appointment.title}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Current time: {formatDateTime(appointment.starts_at)} to {formatDateTime(appointment.ends_at)}
        </p>
        {status ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            Booking {status}.
          </p>
        ) : null}

        <form action={`/api/public/bookings/${encodeURIComponent(token)}/reschedule`} method="post" className="mt-6 grid gap-3">
          <h2 className="text-base font-semibold">Reschedule</h2>
          <input type="date" name="date" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input type="time" name="time" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input type="hidden" name="duration_minutes" value="60" />
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Request New Time
          </button>
        </form>

        <form action={`/api/public/bookings/${encodeURIComponent(token)}/cancel`} method="post" className="mt-6">
          <button className="rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
            Cancel Booking
          </button>
        </form>
      </div>
    </main>
  );
}
