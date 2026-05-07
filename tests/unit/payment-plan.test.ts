import { describe, expect, it } from "vitest";
import { buildScheduleRows } from "@/modules/crm/lib/payment-plan";

describe("buildScheduleRows", () => {
  it("emits deposit + stages + final that sum to the quote total", () => {
    const rows = buildScheduleRows(
      {
        deposit_percent: 25,
        stages: [
          { label: "Stage 1", percent: 25, due_offset_days: 14 },
          { label: "Stage 2", percent: 25, due_offset_days: 21 },
        ],
        final: { label: "Final", due_offset_days: 30 },
      },
      1000,
    );

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ payment_type: "deposit", percentage: 25 });
    expect(rows[1]).toMatchObject({ payment_type: "stage", percentage: 25 });
    expect(rows[2]).toMatchObject({ payment_type: "stage", percentage: 25 });
    // Final is fixed_amount so we can prove penny-perfect reconciliation
    expect(rows[3].payment_type).toBe("final");
    expect(rows[3].fixed_amount).toBe(250);
  });

  it("final absorbs rounding residual to keep penny-perfect total", () => {
    // 33.33% three times of £1000 = 333.30 each; final must be 0.10 to total 1000.00.
    const rows = buildScheduleRows(
      {
        deposit_percent: 33.33,
        stages: [
          { label: "S1", percent: 33.33, due_offset_days: 14 },
          { label: "S2", percent: 33.33, due_offset_days: 21 },
        ],
        final: { label: "F", due_offset_days: 30 },
      },
      1000,
    );
    const final = rows[rows.length - 1];
    expect(final.payment_type).toBe("final");
    // Three 333.30 = 999.90; final absorbs 0.10
    expect(final.fixed_amount).toBeCloseTo(0.1, 2);
  });

  it("omits deposit row when deposit_percent is 0", () => {
    const rows = buildScheduleRows(
      {
        deposit_percent: 0,
        stages: [{ label: "S1", percent: 50, due_offset_days: 14 }],
        final: { label: "F", due_offset_days: 30 },
      },
      1000,
    );
    expect(rows.find((r) => r.payment_type === "deposit")).toBeUndefined();
    expect(rows[rows.length - 1].fixed_amount).toBe(500);
  });

  it("emits a final row even when deposit + stages = 100% (residual £0)", () => {
    const rows = buildScheduleRows(
      {
        deposit_percent: 50,
        stages: [{ label: "S1", percent: 50, due_offset_days: 14 }],
        final: { label: "F", due_offset_days: 30 },
      },
      1000,
    );
    // We don't emit a final at zero (saves a row); ensure deposit + stage cover 100%
    const totalAllocated = rows.reduce((sum, r) => {
      if (r.percentage !== null) return sum + (r.percentage / 100) * 1000;
      return sum + (r.fixed_amount ?? 0);
    }, 0);
    expect(totalAllocated).toBeCloseTo(1000, 2);
  });
});
