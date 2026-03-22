"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoReadonlyNotice } from "@/modules/crm/components/demo/DemoReadonlyNotice";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

export function AttachmentActions({
  attachmentId,
  canDelete = false,
}: {
  attachmentId: string;
  canDelete?: boolean;
}) {
  const demo = useCrmDemoMode();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"open" | "delete" | null>(null);

  async function handleOpen() {
    setBusyAction("open");
    setError(null);

    const response = await fetch(`/api/crm/attachments/${attachmentId}`);
    const result = await response.json().catch(() => ({ error: "Attachment request failed." }));
    if (!response.ok || !result.signedUrl) {
      setError(result.error ?? "Attachment request failed.");
      setBusyAction(null);
      return;
    }

    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    setBusyAction(null);
  }

  async function handleDelete() {
    setBusyAction("delete");
    setError(null);

    const response = await fetch(`/api/crm/attachments/${attachmentId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({ error: "Delete failed." }));
    if (!response.ok) {
      setError(result.error ?? "Delete failed.");
      setBusyAction(null);
      return;
    }

    setBusyAction(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={busyAction !== null}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {busyAction === "open" ? "Opening..." : "Open"}
        </button>
        {canDelete && !demo.active ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busyAction !== null}
            className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {busyAction === "delete" ? "Deleting..." : "Delete"}
          </button>
        ) : null}
      </div>
      {canDelete ? <DemoReadonlyNotice className="text-right text-xs" /> : null}
      {error ? <p className="text-right text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
