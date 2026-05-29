import { ReportsClientPanel } from "@/modules/crm/components/client/CrmFastScreenPanels";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { getCrmSetupState } from "@/modules/crm/lib/setup";

export default async function ReportsPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireSettingsAccess();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Management KPIs for revenue, pipeline conversion, job delivery, and engineer workload.</p>
      </div>

      <ReportsClientPanel />
    </div>
  );
}
