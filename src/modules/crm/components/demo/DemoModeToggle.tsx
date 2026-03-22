"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { crmDemoSteps } from "@/modules/crm/lib/demo";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

export function DemoModeToggle({ canManage }: { canManage: boolean }) {
  const demo = useCrmDemoMode();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return null;
  }

  async function handleToggle() {
    setBusy(true);
    setError(null);

    const endpoint = demo.active ? "/api/crm/demo/stop" : "/api/crm/demo/start";
    const response = await fetch(endpoint, { method: "POST" });
    const result = await response.json().catch(() => ({ error: "Demo mode request failed." }));
    if (!response.ok) {
      setError(result.error ?? "Demo mode request failed.");
      setBusy(false);
      return;
    }

    if (demo.active) {
      router.refresh();
    } else {
      router.push(crmDemoSteps[0]?.route ?? "/dashboard");
      router.refresh();
    }

    setBusy(false);
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        className={`rounded-lg px-3 py-2 text-xs font-semibold ${demo.active ? "bg-amber-500 text-slate-950 hover:bg-amber-400" : "bg-slate-900 text-white hover:bg-slate-800"} disabled:cursor-not-allowed disabled:bg-slate-400`}
      >
        {busy ? "Working..." : demo.active ? "Exit Demo" : "Start Demo"}
      </button>
      {error ? <p className="text-right text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
