import { describe, expect, it } from "vitest";
import {
  calculateFinalBalanceAmount,
  hasOpenProgressInvoice,
  invoiceKindForPaymentType,
  isProgressInvoiceKind,
  shouldSkipFinalInvoiceForExistingInvoice,
} from "@/modules/crm/lib/invoicing";

describe("invoicing helpers", () => {
  it("maps schedule payment types to invoice kinds", () => {
    expect(invoiceKindForPaymentType("deposit")).toBe("deposit");
    expect(invoiceKindForPaymentType("stage")).toBe("stage");
    expect(invoiceKindForPaymentType("final")).toBe("final");
    expect(invoiceKindForPaymentType("finance")).toBe("standard");
  });

  it("does not treat deposit or stage invoices as final-invoice blockers", () => {
    expect(shouldSkipFinalInvoiceForExistingInvoice({ invoice_kind: "deposit", status: "paid" })).toBe(false);
    expect(shouldSkipFinalInvoiceForExistingInvoice({ invoice_kind: "stage", status: "unpaid" })).toBe(false);
    expect(shouldSkipFinalInvoiceForExistingInvoice({ invoice_kind: "final", status: "unpaid" })).toBe(true);
    expect(shouldSkipFinalInvoiceForExistingInvoice({ invoice_kind: "standard", status: "void" })).toBe(false);
  });

  it("calculates final balance after paid progress invoices", () => {
    expect(isProgressInvoiceKind("deposit")).toBe(true);
    expect(calculateFinalBalanceAmount({ quoteTotal: 1200, paidProgressTotal: 300 })).toBe(900);
    expect(calculateFinalBalanceAmount({ quoteTotal: 1200, paidProgressTotal: 1200 })).toBe(0);
  });

  it("detects open progress invoices that must be reconciled before final billing", () => {
    expect(hasOpenProgressInvoice([{ invoice_kind: "deposit", status: "unpaid" }])).toBe(true);
    expect(hasOpenProgressInvoice([{ invoice_kind: "deposit", status: "paid" }])).toBe(false);
    expect(hasOpenProgressInvoice([{ invoice_kind: "final", status: "unpaid" }])).toBe(false);
  });
});
