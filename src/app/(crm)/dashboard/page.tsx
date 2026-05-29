import { DashboardClientPanel, EngineerHomeClientPanel } from "@/modules/crm/components/client/CrmFastScreenPanels";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { getUiPreference } from "@/app/actions/ui-preference";

export default async function DashboardPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireCrmUser();
  const demoState = await getCrmDemoState();

  if (session.profile?.role === "engineer") {
    const uiMode = await getUiPreference();
    return <EngineerHomeClientPanel uiMode={uiMode === "classic" ? "classic" : "commsoft"} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Live CRM overview from Supabase.</p>
      </div>

      <DashboardClientPanel demoActive={demoState.active} />
    </div>
  );
}
