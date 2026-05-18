import { notFound } from "next/navigation";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { DemoRunStage } from "@/modules/crm/demo-console/DemoRunStage";

// Demo Console fullscreen prospect-facing view (ticket D-1).
// The parent layout suppresses CRM chrome when pathname starts with
// /demo/run — see src/app/(crm)/layout.tsx.
//
// Server component: enforces the tenant gate and reads env-derived
// numbers (DEMO_VOICE_NUMBER / DEMO_SMS_NUMBER / DEMO_WHATSAPP_NUMBER),
// passes them down to the client stage. The stage owns interaction
// state (session, operator panel toggle, etc.).

export default async function DemoRunPage() {
  const session = await requireCrmUser();

  if (!session.settings?.demo_console_enabled) {
    notFound();
  }
  if (!userCanManageSettings(session.profile?.role)) {
    notFound();
  }

  return (
    <DemoRunStage
      tenantId={session.tenant?.id ?? null}
      tenantName={session.tenant?.name ?? "Demo tenant"}
      voiceNumber={process.env.DEMO_VOICE_NUMBER ?? null}
      smsNumber={process.env.DEMO_SMS_NUMBER ?? null}
      whatsappNumber={process.env.DEMO_WHATSAPP_NUMBER ?? null}
    />
  );
}
