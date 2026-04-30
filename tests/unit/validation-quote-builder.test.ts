import { describe, expect, it } from "vitest";
import { lineItemSchema, packageSchema, paymentPlanSchema, publicAcceptSchema } from "@/modules/crm/lib/validation";

describe("lineItemSchema", () => {
  it("accepts a legacy line {description, qty, unit_price}", () => {
    const r = lineItemSchema.safeParse({ description: "x", qty: 1, unit_price: 10 });
    expect(r.success).toBe(true);
  });

  it("accepts the extended shape with cost, package, section, kind", () => {
    const r = lineItemSchema.safeParse({
      description: "PKG",
      qty: 1,
      unit_price: 100,
      unit_cost: 60,
      product_id: "11111111-1111-4111-8111-111111111111",
      package_id: "22222222-2222-4222-8222-222222222222",
      package_role: "rollup",
      section_id: "sec-1",
      kind: "package_rollup",
    });
    expect(r.success).toBe(true);
  });

  it("accepts qty=0 for section headers", () => {
    const r = lineItemSchema.safeParse({ description: "Section", qty: 0, unit_price: 0, kind: "section_header" });
    expect(r.success).toBe(true);
  });

  it("rejects negative unit_price", () => {
    const r = lineItemSchema.safeParse({ description: "x", qty: 1, unit_price: -5 });
    expect(r.success).toBe(false);
  });

  it("treats empty-string unit_cost as null", () => {
    const r = lineItemSchema.safeParse({ description: "x", qty: 1, unit_price: 10, unit_cost: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.unit_cost).toBeNull();
  });
});

describe("packageSchema", () => {
  it("accepts a package with items", () => {
    const r = packageSchema.safeParse({
      name: "Boiler",
      items: [{ description: "Unit", qty: 1, unit_price: 1500 }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts a package with no items", () => {
    const r = packageSchema.safeParse({ name: "Empty" });
    expect(r.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const r = packageSchema.safeParse({ name: "" });
    expect(r.success).toBe(false);
  });
});

describe("paymentPlanSchema", () => {
  it("accepts a valid plan with deposit + stages + final", () => {
    const r = paymentPlanSchema.safeParse({
      deposit_percent: 25,
      stages: [{ label: "S1", percent: 25, due_offset_days: 14 }],
      final: { label: "Final", due_offset_days: 30 },
    });
    expect(r.success).toBe(true);
  });

  it("rejects deposit + stages > 100%", () => {
    const r = paymentPlanSchema.safeParse({
      deposit_percent: 60,
      stages: [{ label: "S1", percent: 60, due_offset_days: 14 }],
      final: { label: "Final", due_offset_days: 30 },
    });
    expect(r.success).toBe(false);
  });

  it("allows deposit + stages = 100% (final absorbs 0%)", () => {
    const r = paymentPlanSchema.safeParse({
      deposit_percent: 50,
      stages: [{ label: "S1", percent: 50, due_offset_days: 14 }],
      final: { label: "Final", due_offset_days: 30 },
    });
    expect(r.success).toBe(true);
  });
});

describe("publicAcceptSchema", () => {
  it("requires a name of 2+ chars", () => {
    expect(publicAcceptSchema.safeParse({ accepted_by_name: "Jo" }).success).toBe(true);
    expect(publicAcceptSchema.safeParse({ accepted_by_name: "J" }).success).toBe(false);
  });

  it("accepts blank email as null/empty", () => {
    const r = publicAcceptSchema.safeParse({ accepted_by_name: "Jane Doe", accepted_by_email: "" });
    expect(r.success).toBe(true);
  });
});
