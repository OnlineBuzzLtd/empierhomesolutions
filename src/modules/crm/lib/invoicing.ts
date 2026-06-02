import type { InvoiceKind, InvoiceStatus, PaymentType } from "@/modules/crm/types";

export function invoiceKindForPaymentType(paymentType: PaymentType): InvoiceKind {
  switch (paymentType) {
    case "deposit":
      return "deposit";
    case "stage":
      return "stage";
    case "final":
      return "final";
    case "finance":
      return "standard";
  }
}

export function isProgressInvoiceKind(kind: InvoiceKind | string | null | undefined) {
  return kind === "deposit" || kind === "pro_forma" || kind === "stage";
}

export function isFinalInvoiceKind(kind: InvoiceKind | string | null | undefined) {
  return kind === "final" || kind === "standard" || !kind;
}

export function shouldSkipFinalInvoiceForExistingInvoice(input: {
  invoice_kind?: InvoiceKind | string | null;
  status?: InvoiceStatus | string | null;
}) {
  if (input.status === "void") return false;
  return isFinalInvoiceKind(input.invoice_kind);
}

export function calculateFinalBalanceAmount(input: { quoteTotal: number; paidProgressTotal: number }) {
  const quotePence = Math.round(input.quoteTotal * 100);
  const paidPence = Math.round(input.paidProgressTotal * 100);
  return Math.max(0, quotePence - paidPence) / 100;
}

export function hasOpenProgressInvoice(
  invoices: Array<{ invoice_kind?: InvoiceKind | string | null; status?: InvoiceStatus | string | null }>,
) {
  return invoices.some(
    (invoice) => isProgressInvoiceKind(invoice.invoice_kind) && invoice.status !== "paid" && invoice.status !== "void",
  );
}

export function buildFinalBalanceLineItem(input: { amountExVat: number; paidProgressTotal: number }) {
  return [
    {
      description:
        input.paidProgressTotal > 0
          ? "Final balance after paid deposit/stage invoices"
          : "Final balance",
      qty: 1,
      unit_price: input.amountExVat,
    },
  ];
}
