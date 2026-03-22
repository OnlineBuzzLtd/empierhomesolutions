import { AiHubExperience } from "@/modules/crm/components/ai-hub/AiHubExperience";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { getCrmSession, requireCrmUser } from "@/modules/crm/lib/auth";
import { getAddonState, resolveAiHubViewState } from "@/modules/crm/lib/addons";
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Hub</h1>
        <p className="mt-1 text-sm text-slate-500">Paid add-on for inbound customer communications, AI qualification, and CRM-linked follow-up workflows.</p>
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
