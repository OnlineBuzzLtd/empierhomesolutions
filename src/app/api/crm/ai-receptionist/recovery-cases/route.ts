import { jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { listBookingRecoveryCases } from "@/modules/platform/lib/booking-recovery";

export async function GET() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const cases = await listBookingRecoveryCases(supabase, tenant.id);
  return jsonSuccess({ cases });
}
