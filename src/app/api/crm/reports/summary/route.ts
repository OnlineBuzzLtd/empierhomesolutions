import { jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { getReportsSummary } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";

export async function GET() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const demoState = await getCrmDemoState();
  const summary = await getReportsSummary(demoState.mode);
  return jsonSuccess({ summary });
}
