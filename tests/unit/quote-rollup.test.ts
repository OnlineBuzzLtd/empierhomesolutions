import { describe, expect, it } from "vitest";
import { computeLineRollup, computeQuoteRollup } from "@/modules/crm/lib/quote-rollup";
import type { LineItem } from "@/modules/crm/types";

describe("computeLineRollup", () => {
  it("computes line total from qty * price", () => {
    const r = computeLineRollup({ description: "x", qty: 3, unit_price: 10 });
    expect(r.line_total).toBe(30);
  });

  it("returns null margin/profit when unit_cost is missing", () => {
    const r = computeLineRollup({ description: "x", qty: 1, unit_price: 100 });
    expect(r.line_cost).toBeNull();
    expect(r.line_profit).toBeNull();
    expect(r.margin_percent).toBeNull();
    expect(r.markup_percent).toBeNull();
  });

  it("computes margin and markup when cost is present", () => {
    const r = computeLineRollup({ description: "x", qty: 1, unit_price: 100, unit_cost: 60 });
    expect(r.line_cost).toBe(60);
    expect(r.line_profit).toBe(40);
    expect(r.margin_percent).toBe(40);
    expect(r.markup_percent).toBeCloseTo(66.67, 2);
  });

  it("treats section_header rows as zero-effect", () => {
    const r = computeLineRollup({ description: "Section", qty: 0, unit_price: 0, kind: "section_header" });
    expect(r.line_total).toBe(0);
  });

  it("treats package_rollup rows as display-only (zero math contribution)", () => {
    const r = computeLineRollup({ description: "PKG", qty: 1, unit_price: 1000, kind: "package_rollup" });
    expect(r.line_total).toBe(0);
  });

  it("treats package_role=rollup as display-only even without kind set", () => {
    const r = computeLineRollup({ description: "PKG", qty: 1, unit_price: 1000, package_role: "rollup" });
    expect(r.line_total).toBe(0);
  });
});

describe("computeQuoteRollup", () => {
  it("sums priced lines and applies VAT", () => {
    const items: LineItem[] = [
      { description: "A", qty: 1, unit_price: 100, unit_cost: 60 },
      { description: "B", qty: 2, unit_price: 50, unit_cost: 30 },
    ];
    const r = computeQuoteRollup(items, 0.2);
    expect(r.subtotal).toBe(200);
    expect(r.vat).toBe(40);
    expect(r.total).toBe(240);
    expect(r.total_cost).toBe(120);
    expect(r.total_profit).toBe(80);
    expect(r.total_margin_percent).toBe(40);
  });

  it("does not double-count package rollup + components", () => {
    const items: LineItem[] = [
      { description: "Boiler package", qty: 1, unit_price: 3000, unit_cost: 1885, kind: "package_rollup", package_id: "p1", package_role: "rollup" },
      { description: "Boiler unit", qty: 1, unit_price: 1500, unit_cost: 900, package_id: "p1", package_role: "component" },
      { description: "Install labour", qty: 1, unit_price: 1500, unit_cost: 985, package_id: "p1", package_role: "component" },
    ];
    const r = computeQuoteRollup(items, 0.2);
    expect(r.subtotal).toBe(3000); // not 6000
    expect(r.total_cost).toBe(1885);
    expect(r.total).toBe(3600);
  });

  it("returns null totals when no priced row carries cost (legacy line items)", () => {
    const items: LineItem[] = [
      { description: "Legacy", qty: 1, unit_price: 100 },
      { description: "Legacy 2", qty: 2, unit_price: 50 },
    ];
    const r = computeQuoteRollup(items, 0.2);
    expect(r.subtotal).toBe(200);
    expect(r.total_cost).toBeNull();
    expect(r.total_profit).toBeNull();
    expect(r.total_margin_percent).toBeNull();
    expect(r.total_markup_percent).toBeNull();
  });

  it("ignores section headers in totals", () => {
    const items: LineItem[] = [
      { description: "Section A", qty: 0, unit_price: 0, kind: "section_header" },
      { description: "Item", qty: 1, unit_price: 100, unit_cost: 50 },
    ];
    const r = computeQuoteRollup(items, 0.2);
    expect(r.subtotal).toBe(100);
    expect(r.total_cost).toBe(50);
  });

  it("applies VAT only to subtotal (not to package rollup)", () => {
    const items: LineItem[] = [
      { description: "Pkg display", qty: 1, unit_price: 9999, kind: "package_rollup" },
      { description: "Real line", qty: 1, unit_price: 100, unit_cost: 60 },
    ];
    const r = computeQuoteRollup(items, 0.2);
    expect(r.subtotal).toBe(100);
    expect(r.vat).toBe(20);
    expect(r.total).toBe(120);
  });

  it("handles partial cost across lines (cost of priced+costed lines only)", () => {
    const items: LineItem[] = [
      { description: "Costed", qty: 1, unit_price: 100, unit_cost: 60 },
      { description: "No cost", qty: 1, unit_price: 50 }, // missing unit_cost
    ];
    const r = computeQuoteRollup(items, 0.2);
    expect(r.subtotal).toBe(150);
    expect(r.total_cost).toBe(60); // partial — only the costed line
    expect(r.total_profit).toBe(90); // 150 - 60
  });
});
