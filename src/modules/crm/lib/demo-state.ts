import { cookies, headers } from "next/headers";
import { CrmDemoState, crmDemoCookieName, crmDemoScenarioKey, crmDemoSteps, findCrmDemoStepIndex } from "@/modules/crm/lib/demo";
import { resolveCrmDemoSteps } from "@/modules/crm/lib/demo-routes";

export async function getCrmDemoState(): Promise<CrmDemoState> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieValue = cookieStore.get(crmDemoCookieName)?.value;
  const active = cookieValue === crmDemoScenarioKey;
  const pathname = headerStore.get("x-crm-pathname") ?? "";
  const steps = await resolveCrmDemoSteps(crmDemoSteps, active);
  const currentStepIndex = active ? findCrmDemoStepIndex(pathname) : -1;

  return {
    active,
    mode: active ? "demo" : "live",
    scenarioKey: active ? crmDemoScenarioKey : null,
    pathname,
    steps,
    currentStepIndex,
    currentStep: currentStepIndex >= 0 ? steps[currentStepIndex] ?? null : null,
  };
}
