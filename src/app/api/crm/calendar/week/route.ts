import { jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { listAppointmentsForCalendar, listUserProfiles } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { DEFAULT_TIMEZONE, getWeekRange, parseWeekAnchor } from "@/modules/crm/lib/calendar-layout";

export async function GET(request: Request) {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const searchParams = new URL(request.url).searchParams;
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const assignedTo = searchParams.get("assigned_to");
  const weekParam = searchParams.get("week");
  const weekReference = parseWeekAnchor(weekParam) ?? new Date();
  const week = getWeekRange(weekReference, DEFAULT_TIMEZONE);
  const demoState = await getCrmDemoState();
  const [appointments, users] = await Promise.all([
    listAppointmentsForCalendar({
      type,
      status,
      assignedTo,
      mode: demoState.mode,
      from: new Date(week.startIso),
      days: 7,
    }),
    listUserProfiles(demoState.mode),
  ]);

  return jsonSuccess({
    data: {
      appointments,
      users,
      weekReferenceIso: weekReference.toISOString(),
    },
  });
}
