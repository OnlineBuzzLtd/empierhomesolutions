import { jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getDashboardData, getEnquiryCounts, listAppointmentsForCalendar } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { getOfficeInboxFollowUpWindowStart } from "@/modules/crm/lib/office-inbox";
import { countDueFollowUpItems } from "@/modules/crm/lib/today";
import { listBookingRecoveryCases } from "@/modules/platform/lib/booking-recovery";

export async function GET() {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const demoState = await getCrmDemoState();
  const [data, enquiryCounts, cases, followUpItems] = await Promise.all([
    getDashboardData(demoState.mode),
    getEnquiryCounts(demoState.mode),
    demoState.mode === "live"
      ? listBookingRecoveryCases(auth.session.supabase, auth.session.tenant.id).catch(() => [])
      : Promise.resolve([]),
    listAppointmentsForCalendar({
      mode: demoState.mode,
      from: getOfficeInboxFollowUpWindowStart(),
      days: 15,
    }).catch(() => []),
  ]);
  data.newLeadCount = enquiryCounts.todoCount;
  data.followUpDueCount = countDueFollowUpItems(followUpItems);
  data.aiReceptionistReviewCount = cases.length;
  return jsonSuccess({ data });
}
