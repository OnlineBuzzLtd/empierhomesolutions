"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

type Blocker = { type: "hazard" | "checklist" | "certificate"; label: string };

const blockerTypeLabels: Record<Blocker["type"], string> = {
  hazard: "Hazard",
  checklist: "Checklist",
  certificate: "Certificate",
};

const blockerTypeDescriptions: Record<Blocker["type"], string> = {
  hazard: "unresolved",
  checklist: "incomplete",
  certificate: "draft — not completed",
};

export function CompleteJobButton({
  endpoint,
  className,
}: {
  endpoint: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [showBlockers, setShowBlockers] = useState(false);

  async function handleClick() {
    if (showBlockers) {
      setShowBlockers(false);
      setBlockers([]);
    }
    setBusy(true);

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });

    const result = await response.json().catch(() => ({ error: "Request failed." }));

    if (!response.ok) {
      setBusy(false);
      if (result.blockers && Array.isArray(result.blockers) && result.blockers.length > 0) {
        setBlockers(result.blockers as Blocker[]);
        setShowBlockers(true);
      } else {
        setBlockers([]);
        setShowBlockers(true);
      }
      return;
    }

    setSucceeded(true);
    setBusy(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || succeeded}
        className={
          succeeded
            ? "rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-default"
            : (className ?? "rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400")
        }
      >
        {busy ? "Checking..." : succeeded ? "Completed" : "Mark Complete"}
      </button>

      {showBlockers ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">
            {blockers.length > 0
              ? "Cannot complete — resolve the following first:"
              : "Cannot complete this job yet."}
          </p>
          {blockers.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {blockers.map((blocker, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-rose-700">
                  <span className="mt-0.5 flex-shrink-0 font-semibold">{blockerTypeLabels[blocker.type]}:</span>
                  <span>
                    {blocker.label} — {blockerTypeDescriptions[blocker.type]}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
