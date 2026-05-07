import { redirect } from "next/navigation";
import { LiveFrontDeskTester } from "@/modules/crm/components/ai-hub/LiveFrontDeskTester";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { canAccessLiveFrontDeskTester } from "@/modules/crm/lib/ai-hub-live";
import { loadChannelTestRuntimeSnapshot } from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export default async function AiHubPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireCrmUser();
  if (!canAccessLiveFrontDeskTester({ tenantId: session.tenant?.id, role: session.profile?.role })) {
    redirect("/dashboard");
  }

  const env = getCrmEnv();
  const initialSnapshot = await loadChannelTestRuntimeSnapshot(
    env.crmE2ePlatformFixturesEnabled ? ({} as never) : createCrmServiceRoleClient(),
    session.tenant!.id,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Tenant-Linked Runtime Surface</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">AI Hub</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Live channel tester for this tenant. Web chat fires real conversations against the linked CustomerJourneys runtime; SMS, WhatsApp, and phone numbers reflect production wiring. CRM records update here as runtime events land.
        </p>
      </div>

      <LiveFrontDeskTester initialSnapshot={initialSnapshot} />
    </div>
  );
}
