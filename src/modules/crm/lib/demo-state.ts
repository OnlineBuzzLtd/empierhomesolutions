import { cookies, headers } from "next/headers";
import { cache } from "react";
import { getCrmSession } from "@/modules/crm/lib/auth";
import { CrmDemoState, crmDemoCookieName, crmDemoSteps, findCrmDemoStepIndex, resolveCrmDemoMode } from "@/modules/crm/lib/demo";
import { resolveCrmDemoSteps } from "@/modules/crm/lib/demo-routes";

export const getCrmDemoState = cache(async function getCrmDemoState(): Promise<CrmDemoState> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieValue = cookieStore.get(crmDemoCookieName)?.value;
  const session = await getCrmSession();
  const resolvedMode = resolveCrmDemoMode({
    cookieValue,
    isDemoUser: session.profile?.is_demo,
    demoEnabled: session.settings?.demo_mode_enabled ?? true,
  });
  const pathname = headerStore.get("x-crm-pathname") ?? "";
  const steps = await resolveCrmDemoSteps(crmDemoSteps, resolvedMode.active);
  const currentStepIndex = resolvedMode.active ? findCrmDemoStepIndex(pathname) : -1;

  return {
    ...resolvedMode,
    pathname,
    steps,
    currentStepIndex,
    currentStep: currentStepIndex >= 0 ? steps[currentStepIndex] ?? null : null,
  };
});
