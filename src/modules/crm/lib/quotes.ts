import type { LineItem, PaymentType, QuoteDocumentType, QuoteStatus } from "@/modules/crm/types";

type QuoteSnapshotInput = {
  tenantId: string;
  quoteId: string;
  versionNumber: number;
  documentType: QuoteDocumentType;
  lineItems: LineItem[];
  subtotal: number;
  vatRate: number;
  vatCategory: string;
  total: number;
  validUntil: string | null;
  status: QuoteStatus;
  changeSummary?: string | null;
  createdBy?: string | null;
};

export async function snapshotQuoteVersion(
  supabase: { schema: (schema: string) => { from: (table: string) => { insert: (values: Record<string, unknown>) => unknown } } },
  input: QuoteSnapshotInput,
) {
  const result = (await supabase.schema("crm").from("quote_versions").insert({
    tenant_id: input.tenantId,
    quote_id: input.quoteId,
    version_number: input.versionNumber,
    document_type: input.documentType,
    line_items: input.lineItems,
    subtotal: input.subtotal,
    vat_rate: input.vatRate,
    vat_category: input.vatCategory,
    total: input.total,
    valid_until: input.validUntil,
    status: input.status,
    change_summary: input.changeSummary ?? null,
    created_by: input.createdBy ?? null,
  })) as { error: { message?: string } | null };

  const error = result.error;
  if (error) {
    throw new Error(error.message ?? "Failed to snapshot quote version.");
  }
}

export function calculateInvoiceScheduleAmount({
  subtotal,
  vatRate,
  percentage,
  fixedAmount,
}: {
  subtotal: number;
  vatRate: number;
  percentage: number | null;
  fixedAmount: number | null;
}) {
  const baseSubtotal = percentage !== null ? subtotal * (percentage / 100) : fixedAmount ?? 0;
  const total = baseSubtotal + baseSubtotal * vatRate;
  return {
    subtotal: Number(baseSubtotal.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

export function buildInvoiceScheduleLineItem({
  label,
  paymentType,
  amount,
}: {
  label: string;
  paymentType: PaymentType;
  amount: number;
}) {
  return [
    {
      description: `${label} (${paymentType})`,
      qty: 1,
      unit_price: amount,
    },
  ];
}
