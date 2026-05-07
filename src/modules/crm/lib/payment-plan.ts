// Payment plan -> invoice_schedules translator.
//
// Decision (locked): the FINAL stage absorbs any rounding residual.
// We compute deposit + each named stage from the percentage in pence,
// then the final row is fixed_amount = total - sum(others). This means
// deposit + stages + final always reconcile exactly to the quote total
// to the penny, regardless of fractional percentages.

import type { PaymentPlan } from "@/modules/crm/types";

export type ScheduleRowDraft = {
  label: string;
  payment_type: "deposit" | "stage" | "final";
  percentage: number | null;
  fixed_amount: number | null;
  due_offset_days: number;
};

function pence(value: number): number {
  return Math.round(value * 100);
}

function fromPence(p: number): number {
  return Math.round(p) / 100;
}

export function buildScheduleRows(plan: PaymentPlan, totalAmount: number): ScheduleRowDraft[] {
  const rows: ScheduleRowDraft[] = [];
  const totalPence = pence(totalAmount);
  let consumedPence = 0;

  if (plan.deposit_percent > 0) {
    const depositPence = Math.round((plan.deposit_percent / 100) * totalPence);
    consumedPence += depositPence;
    rows.push({
      label: plan.deposit_label?.trim() || "Deposit",
      payment_type: "deposit",
      percentage: plan.deposit_percent,
      fixed_amount: null,
      due_offset_days: plan.deposit_due_offset_days ?? 0,
    });
  }

  for (const stage of plan.stages) {
    if (stage.percent <= 0) continue;
    const stagePence = Math.round((stage.percent / 100) * totalPence);
    consumedPence += stagePence;
    rows.push({
      label: stage.label,
      payment_type: "stage",
      percentage: stage.percent,
      fixed_amount: null,
      due_offset_days: stage.due_offset_days,
    });
  }

  const finalPence = totalPence - consumedPence;
  if (finalPence < 0) {
    // Defensive: validation should already prevent this, but never bill
    // negative. Cap at 0 and rely on UI to surface the error.
    rows.push({
      label: plan.final.label,
      payment_type: "final",
      percentage: null,
      fixed_amount: 0,
      due_offset_days: plan.final.due_offset_days,
    });
  } else if (finalPence > 0 || rows.length === 0) {
    rows.push({
      label: plan.final.label,
      payment_type: "final",
      percentage: null,
      fixed_amount: fromPence(finalPence),
      due_offset_days: plan.final.due_offset_days,
    });
  }

  return rows;
}
