"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobChecklist } from "@/modules/crm/types";
import { isMaterialsUsedChecklist } from "@/modules/crm/lib/materials";

export function LeaveQuestionsModal({
  jobId,
  mandatoryChecklists,
  hasReceiptAttachment,
  onClose,
}: {
  jobId: string;
  mandatoryChecklists: JobChecklist[];
  hasReceiptAttachment: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChecklists = mandatoryChecklists.length > 0;
  const materialsChecklist = mandatoryChecklists.find(isMaterialsUsedChecklist);
  const materialsUsed = materialsChecklist ? answers[materialsChecklist.id] === "Yes" : false;

  async function uploadReceiptIfNeeded() {
    if (!materialsUsed || hasReceiptAttachment) {
      return true;
    }

    if (!receiptFile) {
      setError("Upload a receipt photo before completing when materials were used.");
      return false;
    }

    const formData = new FormData();
    formData.set("entity_type", "job");
    formData.set("entity_id", jobId);
    formData.set("file_type", "receipt");
    formData.set("file", receiptFile);

    const response = await fetch("/api/crm/attachments/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({ error: "Receipt upload failed." }));
      setError(result.error ?? "Receipt upload failed.");
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);

    try {
      if (materialsChecklist && !answers[materialsChecklist.id]) {
        setError("Answer whether materials were used before completing.");
        setBusy(false);
        return;
      }

      const receiptUploaded = await uploadReceiptIfNeeded();
      if (!receiptUploaded) {
        setBusy(false);
        return;
      }

      // Mark each mandatory checklist as completed, storing the answer as notes
      if (hasChecklists) {
        const results = await Promise.all(
          mandatoryChecklists.map((checklist) =>
            fetch(`/api/crm/jobs/${jobId}/checklists/${checklist.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "completed",
                notes: answers[checklist.id]?.trim() || checklist.notes || null,
              }),
            }),
          ),
        );

        const failed = results.find((r) => !r.ok);
        if (failed) {
          setError("Failed to save one or more answers. Please try again.");
          setBusy(false);
          return;
        }
      }

      // Complete the job
      const res = await fetch(`/api/crm/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not complete job. Please try again.");
        setBusy(false);
        return;
      }

      setBusy(false);
      startTransition(() => router.refresh());
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#4a7fa5] px-4 py-4">
        <h2 className="text-base font-semibold text-white">Leave questions</h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="text-white disabled:opacity-50"
            aria-label="Submit"
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-white disabled:opacity-50"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Questions */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {error ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
            <p className="text-sm font-medium text-rose-700">{error}</p>
          </div>
        ) : null}

        {hasChecklists ? (
          mandatoryChecklists.map((checklist) => (
            <div key={checklist.id}>
              <div className="block">
                <span className="text-sm font-semibold text-slate-900">
                  {checklist.title}
                  <span className="ml-1 text-rose-600">*</span>
                </span>
                {checklist.notes ? (
                  <span className="mt-0.5 block text-xs text-emerald-600">{checklist.notes}</span>
                ) : null}
                {isMaterialsUsedChecklist(checklist) ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {["No", "Yes"].map((value) => {
                        const selected = answers[checklist.id] === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [checklist.id]: value }))}
                            disabled={busy}
                            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                              selected
                                ? "border-[#4a7fa5] bg-[#4a7fa5] text-white"
                                : "border-slate-300 bg-white text-slate-700"
                            }`}
                          >
                            {value}
                          </button>
                        );
                      })}
                    </div>
                    {answers[checklist.id] === "Yes" && !hasReceiptAttachment ? (
                      <label className="block rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <span className="text-xs font-semibold text-amber-900">Receipt photo required</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                          disabled={busy}
                          className="mt-2 w-full text-sm text-slate-700"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 border-b border-slate-300">
                    <input
                      type="text"
                      value={answers[checklist.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [checklist.id]: e.target.value }))}
                      placeholder="Tap To Enter..."
                      className="w-full bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      disabled={busy}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl bg-slate-50 p-5 text-center">
            <p className="text-sm text-slate-600">No required questions for this job.</p>
            <p className="mt-1 text-xs text-slate-400">Tap the check mark to complete and leave site.</p>
          </div>
        )}
      </div>

      {/* Footer action */}
      <div className="border-t border-slate-200 px-4 py-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="w-full rounded-xl bg-[#5cb85c] py-4 text-sm font-semibold text-white hover:bg-[#4cae4c] disabled:opacity-50"
        >
          {busy ? "Saving..." : "Complete & Leave Site"}
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M4 11l5 5 9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
