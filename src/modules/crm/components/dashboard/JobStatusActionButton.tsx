"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobStatus } from "@/modules/crm/types";

export function JobStatusActionButton({
  endpoint,
  status,
  label,
  className,
}: {
  endpoint: string;
  status: JobStatus;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    const result = await response.json().catch(() => ({ error: "Request failed." }));
    if (!response.ok) {
      setError(result.error ?? "Request failed.");
      setBusy(false);
      return;
    }

    setBusy(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={className ?? "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"}
      >
        {busy ? "Working..." : label}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
