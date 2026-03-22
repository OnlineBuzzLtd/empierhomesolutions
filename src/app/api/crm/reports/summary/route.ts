import { jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { getReportsSummary } from "@/modules/crm/lib/data";

export async function GET() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const summary = await getReportsSummary();
  return jsonSuccess({ summary });
}
