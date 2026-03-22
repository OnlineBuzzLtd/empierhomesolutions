"use client";

import type { ReactNode } from "react";
import { DemoPlaybackCard } from "@/modules/crm/components/demo/DemoPlaybackCard";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

export function DemoAnchor({
  name,
  children,
}: {
  name?: string;
  children: ReactNode;
}) {
  const demo = useCrmDemoMode();
  const highlighted = Boolean(name && demo.active && demo.currentStep?.targetAnchor === name);

  return (
    <div
      data-demo-anchor={name}
      className={highlighted ? "rounded-2xl ring-4 ring-amber-300 ring-offset-4 ring-offset-slate-50 transition-shadow" : undefined}
    >
      {highlighted && demo.currentStep?.playback ? (
        <DemoPlaybackCard playback={demo.currentStep.playback} replayKey={`${demo.currentStep.route}:${name ?? "anchor"}`} />
      ) : null}
      {children}
    </div>
  );
}
