import { notFound } from "next/navigation";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import {
  fetchCustomerJourneysTenantNumbers,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { DemoRunStage } from "@/modules/crm/demo-console/DemoRunStage";

// Demo Console fullscreen prospect-facing view.
//
// Number resolution priority (first hit wins):
//   1. crm.customerjourneys_runtime_links.display_*_number — populated
//      by CJ onboarding for every tenant that has been provisioned.
//      Same source of truth the CRM's readiness checks use. Available
//      immediately, no cross-service call.
//   2. platform-api /v1/internal/crm/tenants/:tenantId/numbers — falls
//      back when the link's display_*_number fields are null (older
//      tenants pre-readiness flow, or partially-onboarded ones).
//   3. DEMO_* env vars — final fallback for dev/staging setups without
//      a CJ runtime link at all.
//
// Tenant gate + role gate enforced before any fetch happens.

export default async function DemoRunPage() {
  const session = await requireCrmUser();

  if (!session.settings?.demo_console_enabled) {
    notFound();
  }
  if (!userCanManageSettings(session.profile?.role)) {
    notFound();
  }

  const tenantId = session.tenant?.id ?? null;
  const admin = createCrmServiceRoleClient();
  const link = tenantId ? await getCustomerJourneysRuntimeLink(admin, tenantId) : null;

  // (1) Runtime link display fields — Empire's row has these populated
  // (display_voice_number, display_sms_number, display_whatsapp_number).
  const linkVoice = link?.display_voice_number ?? null;
  const linkSms = link?.display_sms_number ?? null;
  const linkWa = link?.display_whatsapp_number ?? null;

  // (2) Platform-api fallback. Only call if any of the three link
  // fields are missing — saves the round-trip for tenants where the
  // link already has everything.
  const needsPlatformApiFallback = !linkVoice || !linkSms || !linkWa;
  const numbersFromPlatformApi = needsPlatformApiFallback
    ? await fetchCustomerJourneysTenantNumbers(link)
    : null;

  const voiceNumber =
    linkVoice ?? numbersFromPlatformApi?.voiceNumber ?? process.env.DEMO_VOICE_NUMBER ?? null;
  const smsNumber =
    linkSms ?? numbersFromPlatformApi?.smsNumber ?? process.env.DEMO_SMS_NUMBER ?? null;
  const whatsappNumber =
    linkWa ??
    numbersFromPlatformApi?.whatsappDisplayNumber ??
    process.env.DEMO_WHATSAPP_NUMBER ??
    null;

  // Banner surfaces only when numbers came from runtime link or
  // platform-api — i.e. the real Empire/tenant Twilio sender. Env-var
  // path means a separate (dev/test) sender is in use and the banner
  // isn't relevant.
  const fromLiveInfra = linkVoice || linkSms || linkWa || numbersFromPlatformApi !== null;

  return (
    <DemoRunStage
      tenantId={tenantId}
      tenantName={session.tenant?.name ?? "Demo tenant"}
      voiceNumber={voiceNumber}
      smsNumber={smsNumber}
      whatsappNumber={whatsappNumber}
      numbersSource={fromLiveInfra ? "platform_api" : "env_or_none"}
    />
  );
}
