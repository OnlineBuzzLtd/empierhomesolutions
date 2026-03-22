import type { LineItem, Product, Quote, QuoteTemplate } from "@/modules/crm/types";

export function buildCatalogLineItem(product: Pick<Product, "name" | "sell_price">): LineItem {
  return {
    description: product.name,
    qty: 1,
    unit_price: Number(product.sell_price ?? 0),
  };
}

export function buildQuoteDraftFromTemplate(template: QuoteTemplate | null | undefined): Partial<Quote> | undefined {
  if (!template) {
    return undefined;
  }

  return {
    line_items: template.line_items,
    vat_category: "standard_20",
    vat_rate: 0.2,
    status: "draft",
  };
}

export function summarizePaymentTerms(paymentTerms: Record<string, unknown> | null | undefined) {
  if (!paymentTerms) {
    return null;
  }

  const entries = Object.entries(paymentTerms)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim().length > 0)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`);

  return entries.length > 0 ? entries.join(" · ") : null;
}

export function parsePaymentTermsInput(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return JSON.parse(value) as Record<string, unknown>;
}
