"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

export function DemoPanel() {
  const demo = useCrmDemoMode();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!demo.active) {
    return null;
  }

  const currentIndex = demo.currentStepIndex >= 0 ? demo.currentStepIndex : 0;
  const currentStep = demo.currentStep ?? demo.steps[currentIndex] ?? demo.steps[0] ?? null;
  const previousStep = currentIndex > 0 ? demo.steps[currentIndex - 1] : null;
  const nextStep = currentIndex < demo.steps.length - 1 ? demo.steps[currentIndex + 1] : null;

  async function handleExit() {
    setBusy(true);
    setError(null);

    const response = await fetch("/api/crm/demo/stop", { method: "POST" });
    const result = await response.json().catch(() => ({ error: "Demo mode request failed." }));
    if (!response.ok) {
      setError(result.error ?? "Demo mode request failed.");
      setBusy(false);
      return;
    }

    setBusy(false);
    router.refresh();
  }

  function openRoute(route: string) {
    router.push(route);
  }

  return (
    <aside className="fixed bottom-4 right-4 z-40 w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl shadow-slate-900/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Demo Mode</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{currentStep?.title ?? "Core Walkthrough"}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Step {currentIndex + 1} of {demo.steps.length}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExit}
          disabled={busy}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {busy ? "Stopping..." : "Exit Demo"}
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-700">{currentStep?.description ?? "This walkthrough explains the live CRM feature set using dedicated demo records."}</p>
      {currentStep?.playback ? <p className="mt-2 text-xs text-slate-500">{currentStep.playback.headline}. Watch the highlighted section replay it live.</p> : null}
      {currentStep?.nextHint ? <p className="mt-2 text-xs text-slate-500">{currentStep.nextHint}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {previousStep ? (
          <button
            type="button"
            onClick={() => openRoute(previousStep.openRoute ?? previousStep.route)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        ) : null}
        {currentStep ? (
          <button
            type="button"
            onClick={() => openRoute(currentStep.openRoute ?? currentStep.route)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Feature
          </button>
        ) : null}
        {nextStep ? (
          <button
            type="button"
            onClick={() => openRoute(nextStep.openRoute ?? nextStep.route)}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Next
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-rose-700">{error}</p> : null}
    </aside>
  );
}
