import { redirect } from "next/navigation";
import { LiveFrontDeskTester } from "@/modules/crm/components/ai-hub/LiveFrontDeskTester";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { canAccessLiveFrontDeskTester } from "@/modules/crm/lib/ai-hub-live";
import { loadChannelTestRuntimeSnapshot } from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export default async function AiHubLivePage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireCrmUser();
  if (!canAccessLiveFrontDeskTester({ tenantId: session.tenant?.id, role: session.profile?.role })) {
    redirect("/ai-hub");
  }

  const env = getCrmEnv();
  const initialSnapshot = await loadChannelTestRuntimeSnapshot(
    env.crmE2ePlatformFixturesEnabled ? ({} as never) : createCrmServiceRoleClient(),
    session.tenant!.id,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Tenant-Linked Runtime Surface</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Live Channel Tester</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Use the linked CustomerJourneys runtime for real Web chat testing and live SMS, WhatsApp, and phone numbers. CRM records update here as runtime events land.
          </p>
        </div>
        <a href="/ai-hub" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back to AI Hub
        </a>
      </div>

      <LiveFrontDeskTester initialSnapshot={initialSnapshot} />
    </div>
  );
}
