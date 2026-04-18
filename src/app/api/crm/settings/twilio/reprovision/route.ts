import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { ensureTenantTwilioProvisioning } from "@/modules/crm/lib/twilio-provisioning";

export async function POST() {
  try {
    const auth = await requireManagerCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }
    const { tenant } = auth.session;
    if (!tenant) {
      return jsonError("No active tenant.", 400);
    }

    const admin = createCrmServiceRoleClient();
    const result = await ensureTenantTwilioProvisioning(admin, {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    });

    return jsonSuccess({
      state: result.state,
      runtime: result.runtime
        ? {
            channels: result.runtime.channels,
            issues: result.runtime.issues,
          }
        : null,
      warnings: result.warnings,
      allChannelsReady: result.allChannelsReady,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to reprovision Twilio.", 500);
  }
}
