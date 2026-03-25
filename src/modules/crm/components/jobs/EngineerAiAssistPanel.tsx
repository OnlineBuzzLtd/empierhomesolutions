"use client";

import { useState } from "react";
import type { EngineerAiAssistAction, EngineerAiAssistDraft, EngineerAiAssistState } from "@/modules/crm/types";

const actionConfig: Array<{ action: EngineerAiAssistAction; label: string }> = [
  { action: "summary", label: "Summarize Job" },
  { action: "arrival_note_draft", label: "Draft Arrival Note" },
  { action: "completion_note_draft", label: "Draft Work Completed Note" },
  { action: "customer_update_draft", label: "Draft Customer Update" },
  { action: "missing_evidence_check", label: "Check Missing Evidence" },
];

export function EngineerAiAssistPanel({
  jobId,
  access,
  onUseDraft,
}: {
  jobId: string;
  access: EngineerAiAssistState;
  onUseDraft: (draft: EngineerAiAssistDraft) => void;
}) {
  const [draft, setDraft] = useState<EngineerAiAssistDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<EngineerAiAssistAction | null>(null);

  async function runAction(action: EngineerAiAssistAction) {
    try {
      setLoadingAction(action);
      setError(null);
      const response = await fetch(`/api/crm/jobs/${jobId}/ai-assist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({ error: "AI Assist request failed." }));
      if (!response.ok) {
        setError(result.error ?? "AI Assist request failed.");
        setLoadingAction(null);
        return;
      }

      setDraft(result.draft as EngineerAiAssistDraft);
      setLoadingAction(null);
    } catch {
      setError("AI Assist is unavailable right now.");
      setLoadingAction(null);
    }
  }

  if (access === "locked") {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI Assist</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Field copilot locked</h2>
            <p className="mt-2 text-sm text-slate-600">This job view can surface AI-ready notes, summaries, and evidence checks once the AI add-on is enabled for the live account.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Locked</span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI Assist</p>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${access === "demo" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
              {access === "demo" ? "Demo Access" : "Enabled"}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Field-ready job copilot</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Generate short, reviewable drafts from this job record. Nothing is saved automatically.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {actionConfig.map((item) => (
          <button
            key={item.action}
            type="button"
            onClick={() => runAction(item.action)}
            disabled={loadingAction !== null}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          >
            {loadingAction === item.action ? "Working..." : item.label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

      {draft ? (
        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{draft.title}</p>
              <p className="mt-2 text-sm text-slate-600">{draft.summary}</p>
            </div>
            {draft.note_body ? (
              <button
                type="button"
                onClick={() => onUseDraft(draft)}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Use Draft In Note
              </button>
            ) : null}
          </div>

          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-white px-4 py-4 text-sm text-slate-700">{draft.body}</pre>

          {draft.checks.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {draft.checks.map((check) => (
                <span key={check} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  {check}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
