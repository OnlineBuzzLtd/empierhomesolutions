"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Template = {
  id: string;
  title: string;
  position: number;
  is_active: boolean;
};

export function JobReportTemplatesForm({
  initialTemplates,
}: {
  initialTemplates: Template[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/crm/settings/job-report-templates?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Failed to delete question.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = addValue.trim();
    if (!title) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/settings/job-report-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Failed to add question.");
        return;
      }
      setAddValue("");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        These questions are automatically added to every new job as mandatory checklists.
        Engineers must answer all of them before marking a job complete.
      </p>

      {initialTemplates.length === 0 ? (
        <p className="text-sm text-slate-400">No questions configured yet.</p>
      ) : (
        <ol className="space-y-2">
          {initialTemplates.map((t, i) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
            >
              <span className="w-5 flex-shrink-0 text-center text-xs font-medium text-slate-400">
                {i + 1}
              </span>
              <span className="flex-1 text-sm text-slate-800">{t.title}</span>
              <button
                type="button"
                disabled={busy === t.id}
                onClick={() => handleDelete(t.id)}
                className="flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                title="Remove question"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M2 2l10 10M12 2L2 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={addValue}
          onChange={(e) => setAddValue(e.target.value)}
          placeholder="Add a new question…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={adding || !addValue.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
