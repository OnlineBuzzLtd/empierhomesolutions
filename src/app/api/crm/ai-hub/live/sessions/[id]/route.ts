import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { canAccessLiveFrontDeskTester, loadLiveFrontDeskSession } from "@/modules/crm/lib/ai-hub-live";
import { isLiveAgentRuntimeConfigured } from "@/modules/crm/lib/ai-hub-live-agent";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant, profile } = auth.session;
  if (!canAccessLiveFrontDeskTester({ tenantId: tenant.id, role: profile?.role })) {
    return jsonError("The live front desk tester is only available for Empire tenant 1 management/admin users.", 403);
  }

  const { id } = await context.params;

  try {
    const session = await loadLiveFrontDeskSession(supabase, tenant.id, id);
    if (!session) {
      return jsonError("Live front desk session not found.", 404);
    }

    return jsonSuccess({
      session,
      runtime_configured: isLiveAgentRuntimeConfigured(),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load live front desk session.", 500);
  }
}
