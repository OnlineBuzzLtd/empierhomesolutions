import { describe, expect, it } from "vitest";
import { buildMoneyQueue } from "@/modules/crm/lib/money-queue";
import type { InvoiceWithRelations, QuoteWithRelations } from "@/modules/crm/types";

function invoice(overrides: Partial<InvoiceWithRelations> = {}): InvoiceWithRelations {
  return {
    id: "invoice-1",
    quote_id: null,
    job_id: "job-1",
    customer_id: "customer-1",
    invoice_number: "INV-100",
    line_items: [],
    subtotal: 100,
    vat_rate: 0.2,
    vat_category: "standard_20",
    total: 120,
    status: "unpaid",
    due_date: "2026-06-24",
    paid_at: null,
    created_at: "2026-06-20T09:00:00.000Z",
    customer: { id: "customer-1", full_name: "Jane Smith", address_line1: null, postcode: "UB8 1AA", phone: null },
    job: { id: "job-1", title: "Boiler repair" },
    ...overrides,
  } as InvoiceWithRelations;
}

function quote(overrides: Partial<QuoteWithRelations> = {}): QuoteWithRelations {
  return {
    id: "quote-1",
    job_id: "job-1",
    customer_id: "customer-1",
    quote_number: "Q-100",
    document_type: "quote",
    current_version_number: 1,
    line_items: [],
    subtotal: 1000,
    vat_rate: 0.2,
    vat_category: "standard_20",
    total: 1200,
    status: "accepted",
    valid_until: "2026-06-30",
    created_at: "2026-06-20T09:00:00.000Z",
    customer: { id: "customer-1", full_name: "Jane Smith", address_line1: null, postcode: "UB8 1AA", phone: null },
    job: { id: "job-1", title: "Boiler install" },
    ...overrides,
  } as QuoteWithRelations;
}

describe("buildMoneyQueue", () => {
  it("prioritizes overdue invoices and accepted quotes", () => {
    const queue = buildMoneyQueue({
      invoices: [
        invoice({ id: "future", invoice_number: "INV-101", due_date: "2026-06-30" }),
        invoice({ id: "overdue", invoice_number: "INV-099", due_date: "2026-06-23" }),
      ],
      quotes: [quote()],
      now: new Date("2026-06-25T09:00:00.000Z"),
    });

    expect(queue.items.map((item) => item.id)).toEqual(["invoice:overdue", "quote:quote-1", "invoice:future"]);
    expect(queue.items[0]).toMatchObject({ dueLabel: "Overdue", action: "Chase", priority: "high" });
    expect(queue.items[1]).toMatchObject({ dueLabel: "Ready to invoice", action: "Invoice", priority: "high" });
    expect(queue.summary).toEqual({
      totalCount: 3,
      overdueCount: 1,
      invoiceCount: 2,
      quoteCount: 1,
      firstAction: "Chase overdue invoices first",
    });
  });

  it("keeps paid invoices and declined quotes out of the queue", () => {
    const queue = buildMoneyQueue({
      invoices: [invoice({ status: "paid" })],
      quotes: [quote({ status: "declined" })],
    });

    expect(queue.items).toEqual([]);
    expect(queue.summary.firstAction).toBe("No money needs chasing");
  });
});
