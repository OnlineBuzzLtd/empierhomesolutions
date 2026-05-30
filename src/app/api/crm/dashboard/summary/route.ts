import { jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getDashboardData, getEnquiryCounts } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { listBookingRecoveryCases } from "@/modules/platform/lib/booking-recovery";

export async function GET() {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const demoState = await getCrmDemoState();
  const [data, enquiryCounts, cases] = await Promise.all([
    getDashboardData(demoState.mode),
    getEnquiryCounts(demoState.mode),
    demoState.mode === "live"
      ? listBookingRecoveryCases(auth.session.supabase, auth.session.tenant.id).catch(() => [])
      : Promise.resolve([]),
  ]);
  data.newLeadCount = enquiryCounts.todoCount + cases.length;
  data.aiReceptionistReviewCount = cases.length;
  return jsonSuccess({ data });
}
