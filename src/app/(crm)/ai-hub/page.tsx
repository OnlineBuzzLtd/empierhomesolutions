import { redirect } from "next/navigation";
import { BookingRecoveryPanel } from "@/modules/crm/components/ai-hub/BookingRecoveryPanel";
import { LiveFrontDeskTester } from "@/modules/crm/components/ai-hub/LiveFrontDeskTester";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { canAccessLiveFrontDeskTester } from "@/modules/crm/lib/ai-hub-live";
import { loadChannelTestRuntimeSnapshot } from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { listBookingRecoveryCases } from "@/modules/platform/lib/booking-recovery";

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
  const serviceRole = env.crmE2ePlatformFixturesEnabled ? ({} as never) : createCrmServiceRoleClient();
  const initialSnapshot = await loadChannelTestRuntimeSnapshot(
    serviceRole,
    session.tenant!.id,
  );
  const recoveryCases = env.crmE2ePlatformFixturesEnabled
    ? []
    : await listBookingRecoveryCases(serviceRole, session.tenant!.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Customer calls and messages</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">AI Receptionist</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Review conversations, missed calls, follow-ups, settings, and test how the receptionist responds before customers do.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        {["Conversations", "Missed Calls", "Follow-ups", "Settings", "Test"].map((tab) => (
          <a
            key={tab}
            href={`/ai-hub?tab=${tab.toLowerCase().replace(/\s+/g, "-")}`}
            className={`rounded-full px-3 py-1.5 ${
              tab === "Test" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab}
          </a>
        ))}
      </div>

      <BookingRecoveryPanel cases={recoveryCases} />
      <LiveFrontDeskTester initialSnapshot={initialSnapshot} />
    </div>
  );
}
