import type { InvoiceWithRelations, QuoteWithRelations } from "@/modules/crm/types";
import { formatCurrency, formatDate } from "@/modules/crm/lib/format";

export type MoneyQueueItem = {
  id: string;
  kind: "invoice" | "quote";
  title: string;
  detail: string;
  amount: string;
  dueLabel: string;
  href: string;
  action: "Send" | "Chase" | "Invoice" | "Open";
  priority: "high" | "medium" | "normal";
  sortDate: string;
};

export function buildMoneyQueue({
  invoices,
  quotes = [],
  now = new Date(),
  limit = 10,
}: {
  invoices: InvoiceWithRelations[];
  quotes?: QuoteWithRelations[];
  now?: Date;
  limit?: number;
}) {
  const items = [
    ...invoices.filter(isOpenInvoice).map((invoice) => buildInvoiceQueueItem(invoice, now)),
    ...quotes.filter(isActionableQuote).map((quote) => buildQuoteQueueItem(quote, now)),
  ].sort(compareMoneyQueueItems);

  return {
    items: items.slice(0, limit),
    summary: {
      totalCount: items.length,
      overdueCount: items.filter((item) => item.dueLabel === "Overdue").length,
      invoiceCount: items.filter((item) => item.kind === "invoice").length,
      quoteCount: items.filter((item) => item.kind === "quote").length,
      firstAction:
        items.some((item) => item.dueLabel === "Overdue")
          ? "Chase overdue invoices first"
          : items.some((item) => item.action === "Invoice")
            ? "Invoice accepted quotes"
            : items.length > 0
              ? "Work money from the top"
              : "No money needs chasing",
    },
  };
}

function isOpenInvoice(invoice: InvoiceWithRelations) {
  return invoice.status === "unpaid" || invoice.status === "overdue";
}

function isActionableQuote(quote: QuoteWithRelations) {
  return quote.status === "accepted" || quote.status === "sent";
}

function buildInvoiceQueueItem(invoice: InvoiceWithRelations, now: Date): MoneyQueueItem {
  const overdue = invoice.status === "overdue" || isPastDate(invoice.due_date, now);
  const dueLabel = overdue ? "Overdue" : invoice.due_date ? `Due ${formatDate(invoice.due_date)}` : "No due date";

  return {
    id: `invoice:${invoice.id}`,
    kind: "invoice",
    title: invoice.invoice_number,
    detail: [invoice.customer?.full_name, invoice.job?.title].filter(Boolean).join(" · ") || "Invoice needs action",
    amount: formatCurrency(invoice.total),
    dueLabel,
    href: `/invoices/${invoice.id}`,
    action: overdue ? "Chase" : "Open",
    priority: overdue ? "high" : "medium",
    sortDate: invoice.due_date ?? invoice.created_at,
  };
}

function buildQuoteQueueItem(quote: QuoteWithRelations, now: Date): MoneyQueueItem {
  const expired = quote.status === "sent" && isPastDate(quote.valid_until, now);
  const dueLabel =
    quote.status === "accepted"
      ? "Ready to invoice"
      : expired
        ? "Overdue"
        : quote.valid_until
          ? `Valid until ${formatDate(quote.valid_until)}`
          : "Awaiting decision";

  return {
    id: `quote:${quote.id}`,
    kind: "quote",
    title: quote.quote_number,
    detail: [quote.customer?.full_name, quote.job?.title].filter(Boolean).join(" · ") || "Quote needs action",
    amount: formatCurrency(quote.total),
    dueLabel,
    href: `/quotes/${quote.id}`,
    action: quote.status === "accepted" ? "Invoice" : "Chase",
    priority: quote.status === "accepted" || expired ? "high" : "normal",
    sortDate: quote.valid_until ?? quote.created_at,
  };
}

function compareMoneyQueueItems(left: MoneyQueueItem, right: MoneyQueueItem) {
  const priorityOrder = { high: 0, medium: 1, normal: 2 } as const;
  const priorityDelta = priorityOrder[left.priority] - priorityOrder[right.priority];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return left.sortDate.localeCompare(right.sortDate);
}

function isPastDate(value: string | null, now: Date) {
  if (!value) {
    return false;
  }
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isFinite(date.getTime()) && date.getTime() < now.getTime();
}
