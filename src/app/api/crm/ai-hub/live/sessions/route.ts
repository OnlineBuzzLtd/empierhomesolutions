import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import {
  canAccessLiveFrontDeskTester,
  createLiveFrontDeskSession,
  liveFrontDeskSessionCreateSchema,
} from "@/modules/crm/lib/ai-hub-live";
import { isLiveAgentRuntimeConfigured } from "@/modules/crm/lib/ai-hub-live-agent";

export async function POST(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant, profile } = auth.session;
  if (!canAccessLiveFrontDeskTester({ tenantId: tenant.id, role: profile?.role })) {
    return jsonError("The live front desk tester is only available for Empire tenant 1 management/admin users.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = liveFrontDeskSessionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid live session payload.");
  }

  try {
    const session = await createLiveFrontDeskSession(supabase, tenant.id, parsed.data);
    return jsonSuccess({
      session,
      runtime_configured: isLiveAgentRuntimeConfigured(),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create live front desk session.", 500);
  }
}
