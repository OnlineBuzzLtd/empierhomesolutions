"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

export function AiHubDemoRecordLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const router = useRouter();
  const demo = useCrmDemoMode();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setBusy(true);
    setError(null);

    if (!demo.active) {
      const response = await fetch("/api/crm/demo/start", { method: "POST" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: "Unable to open the CRM demo record." }));
        setError(result.error ?? "Unable to open the CRM demo record.");
        setBusy(false);
        return;
      }
    }

    router.push(href);
    setBusy(false);
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleOpen}
        disabled={busy}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        {busy ? "Opening..." : label}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
