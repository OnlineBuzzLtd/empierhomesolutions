"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { findCrmDemoStepIndex, type CrmDemoState } from "@/modules/crm/lib/demo";

const DemoModeContext = createContext<CrmDemoState>({
  active: false,
  mode: "live",
  scenarioKey: null,
  locked: false,
  pathname: "",
  steps: [],
  currentStepIndex: -1,
  currentStep: null,
});

export function DemoModeProvider({
  children,
  state,
}: {
  children: ReactNode;
  state: CrmDemoState;
}) {
  const pathname = usePathname() ?? state.pathname;
  const currentStepIndex = state.active ? findCrmDemoStepIndex(pathname) : -1;
  const value: CrmDemoState = {
    ...state,
    pathname,
    currentStepIndex,
    currentStep: currentStepIndex >= 0 ? state.steps[currentStepIndex] ?? null : null,
  };

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useCrmDemoMode() {
  return useContext(DemoModeContext);
}
