import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { loadChannelTestRuntimeSnapshot } from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export async function GET() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const env = getCrmEnv();
    const snapshot = await loadChannelTestRuntimeSnapshot(
      env.crmE2ePlatformFixturesEnabled ? ({} as never) : createCrmServiceRoleClient(),
      auth.session.tenant.id,
    );
    return jsonSuccess({
      snapshot,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load the live channel test surface.", 500);
  }
}
