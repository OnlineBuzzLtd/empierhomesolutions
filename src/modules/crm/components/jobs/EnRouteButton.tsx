"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function EnRouteButton({ endpoint, className }: { endpoint: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    setSucceeded(false);
    setAlreadySent(false);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json().catch(() => ({ error: "Request failed." }));

    if (!response.ok) {
      setError(result.error ?? "Request failed.");
      setBusy(false);
      return;
    }

    setSucceeded(true);
    setAlreadySent(Boolean(result.alreadySent));
    setBusy(false);
    startTransition(() => {
      router.refresh();
    });
  }

  const label = busy ? "Sending..." : alreadySent ? "Already Sent" : succeeded ? "Sent" : "En Route";

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || succeeded}
        className={
          succeeded
            ? "rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-default"
            : (className ??
              "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400")
        }
      >
        {label}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
