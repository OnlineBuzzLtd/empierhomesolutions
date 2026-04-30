"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/modules/crm/lib/format";

type Stage = { label: string; percent: number; due_offset_days: number };

export function PaymentPlanEditor({
  quoteId,
  quoteTotal,
  initialDepositPercent = 25,
  initialStages = [],
  initialFinalDays = 30,
}: {
  quoteId: string;
  quoteTotal: number;
  initialDepositPercent?: number;
  initialStages?: Stage[];
  initialFinalDays?: number;
}) {
  const router = useRouter();
  const [depositPercent, setDepositPercent] = useState(initialDepositPercent);
  const [depositDays, setDepositDays] = useState(0);
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [finalLabel, setFinalLabel] = useState("Final payment");
  const [finalDays, setFinalDays] = useState(initialFinalDays);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalAllocated = depositPercent + stages.reduce((sum, s) => sum + s.percent, 0);
  const finalPercent = Math.max(0, 100 - totalAllocated);
  const finalAmount = (quoteTotal * finalPercent) / 100;

  function patchStage(i: number, p: Partial<Stage>) {
    setStages(stages.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }

  function addStage() {
    setStages([...stages, { label: `Stage ${stages.length + 1}`, percent: 25, due_offset_days: 14 }]);
  }

  function removeStage(i: number) {
    setStages(stages.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const body = {
      deposit_percent: depositPercent,
      deposit_label: "Deposit",
      deposit_due_offset_days: depositDays,
      stages,
      final: { label: finalLabel, due_offset_days: finalDays },
    };
    const response = await fetch(`/api/crm/quotes/${quoteId}/payment-plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    setSubmitting(false);
    if (!response.ok) {
      setError(result.error ?? "Save failed.");
      return;
    }
    setSuccess("Payment plan saved.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deposit</p>
        <div className="mt-2 grid grid-cols-[1fr_120px] gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={depositPercent}
            onChange={(e) => setDepositPercent(Number(e.target.value) || 0)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            value={depositDays}
            onChange={(e) => setDepositDays(Number(e.target.value) || 0)}
            placeholder="Days from issue"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {stages.map((s, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <input
              value={s.label}
              onChange={(e) => patchStage(i, { label: e.target.value })}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={() => removeStage(i)} className="text-xs text-rose-600 hover:underline">
              Remove
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={s.percent}
              onChange={(e) => patchStage(i, { percent: Number(e.target.value) || 0 })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="% of quote"
            />
            <input
              type="number"
              min="0"
              value={s.due_offset_days}
              onChange={(e) => patchStage(i, { due_offset_days: Number(e.target.value) || 0 })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Days from issue"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addStage}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Add stage payment
      </button>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Final payment</p>
        <div className="mt-2 grid grid-cols-[1fr_120px] gap-2">
          <input
            value={finalLabel}
            onChange={(e) => setFinalLabel(e.target.value)}
            className="rounded-lg border border-emerald-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            value={finalDays}
            onChange={(e) => setFinalDays(Number(e.target.value) || 0)}
            placeholder="Days from issue"
            className="rounded-lg border border-emerald-300 px-3 py-2 text-sm"
          />
        </div>
        <p className="mt-2 text-xs text-emerald-900">
          Final absorbs the residual: {finalPercent.toFixed(2)}% ({formatCurrency(finalAmount)}).
        </p>
        {totalAllocated > 100 ? (
          <p className="mt-1 text-xs text-rose-700">Deposit + stages exceed 100% — reduce one of them.</p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting || totalAllocated > 100}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? "Saving…" : "Save payment plan"}
        </button>
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}
