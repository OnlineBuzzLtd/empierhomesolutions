import { jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { getPlatformWorkspaceOverview } from "@/modules/platform/lib/repository";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const overview = await getPlatformWorkspaceOverview(supabase, tenant.id);
  return jsonSuccess({
    quality: overview.agentQuality,
    recovery: {
      failedEvents: overview.failedEvents.length,
      failedCommands: overview.failedCommands.length,
      failedOutboxEvents: overview.failedOutboxEvents.length,
    },
  });
}
