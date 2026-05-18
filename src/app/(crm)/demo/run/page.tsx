import { notFound } from "next/navigation";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import {
  fetchCustomerJourneysTenantNumbers,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { DemoRunStage } from "@/modules/crm/demo-console/DemoRunStage";

// Demo Console fullscreen prospect-facing view (ticket D-1, post-E-1).
// The parent layout suppresses CRM chrome when pathname starts with
// /demo/run — see src/app/(crm)/layout.tsx.
//
// Server component: enforces the tenant gate, then reads the tenant's
// real Twilio numbers from platform-api via the runtime link. Falls
// back to DEMO_* env vars if the platform-api call fails or the
// tenant has no runtime link configured (early-onboarding tenants).
// The numbers reach the client tiles via props — no fetch from the
// browser, no risk of leaking the internal-service token client-side.

export default async function DemoRunPage() {
  const session = await requireCrmUser();

  if (!session.settings?.demo_console_enabled) {
    notFound();
  }
  if (!userCanManageSettings(session.profile?.role)) {
    notFound();
  }

  const tenantId = session.tenant?.id ?? null;

  // Pull the runtime link then the numbers. Both can return null at
  // any step; the tiles handle null with their existing "not
  // configured" copy.
  const numbers = await (async () => {
    if (!tenantId) return null;
    const admin = createCrmServiceRoleClient();
    const link = await getCustomerJourneysRuntimeLink(admin, tenantId);
    return fetchCustomerJourneysTenantNumbers(link);
  })();

  // Env-var fallback path preserved so non-platform-api dev setups
  // (local Supabase, no CJ runtime) still show numbers if the operator
  // sets the env vars manually. Platform-api wins when both are set.
  return (
    <DemoRunStage
      tenantId={tenantId}
      tenantName={session.tenant?.name ?? "Demo tenant"}
      voiceNumber={numbers?.voiceNumber ?? process.env.DEMO_VOICE_NUMBER ?? null}
      smsNumber={numbers?.smsNumber ?? process.env.DEMO_SMS_NUMBER ?? null}
      whatsappNumber={
        numbers?.whatsappDisplayNumber ?? process.env.DEMO_WHATSAPP_NUMBER ?? null
      }
      numbersSource={numbers ? "platform_api" : numbers === null ? "env_or_none" : "env_or_none"}
    />
  );
}
