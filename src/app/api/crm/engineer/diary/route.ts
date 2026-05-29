import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getEngineerDashboardData } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";

export async function GET() {
  const auth = await requireCrmApiUser(["engineer"]);
  if ("error" in auth) {
    return auth.error;
  }

  const profile = auth.session.profile;
  if (!profile?.full_name) {
    return jsonError("Engineer profile is incomplete.", 400);
  }

  const demoState = await getCrmDemoState();
  const data = await getEngineerDashboardData(profile.full_name, demoState.mode);
  return jsonSuccess({ data, engineerName: profile.full_name });
}
