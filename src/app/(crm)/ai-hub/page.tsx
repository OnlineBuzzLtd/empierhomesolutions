import { AiHubExperience } from "@/modules/crm/components/ai-hub/AiHubExperience";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { getCrmSession, requireCrmUser } from "@/modules/crm/lib/auth";
import { getAddonState, resolveAiHubViewState } from "@/modules/crm/lib/addons";
import { canAccessLiveFrontDeskTester } from "@/modules/crm/lib/ai-hub-live";
import { getAiHubProvider } from "@/modules/crm/lib/ai-hub";
import { getCrmSetupState } from "@/modules/crm/lib/setup";

export default async function AiHubPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const [session, addon, provider] = await Promise.all([getCrmSession(), getAddonState("ai_comms_hub"), getAiHubProvider()]);
  const [scenarios, aggregateMetrics] = await Promise.all([provider.listScenarios(), provider.getAggregateMetrics()]);
  const viewState = resolveAiHubViewState(addon, session.profile?.role);
  const canUseLiveTester = canAccessLiveFrontDeskTester({ tenantId: session.tenant?.id, role: session.profile?.role });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Hub</h1>
          <p className="mt-1 text-sm text-slate-500">Paid add-on for inbound customer communications, AI qualification, and CRM-linked follow-up workflows.</p>
        </div>
        {canUseLiveTester ? (
          <a href="/ai-hub/live" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Open Channel Tester
          </a>
        ) : null}
      </div>

      {scenarios.length === 0 ? (
        <EmptyState message="AI Hub demo content is not available yet. Apply the latest CRM migration and refresh." />
      ) : (
        <AiHubExperience
          addon={addon}
          aggregateMetrics={aggregateMetrics}
          scenarios={scenarios}
          viewState={viewState}
          canManage={session.profile?.role === "management" || session.profile?.role === "admin"}
        />
      )}
    </div>
  );
}
