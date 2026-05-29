import { jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getDashboardData } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";

export async function GET() {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const demoState = await getCrmDemoState();
  const data = await getDashboardData(demoState.mode);
  return jsonSuccess({ data });
}
