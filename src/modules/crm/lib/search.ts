import type {
  CustomerWithCounts,
  InvoiceWithRelations,
  JobWithRelations,
  LeadWithRelations,
  QuoteWithRelations,
} from "@/modules/crm/types";
import { formatCurrency, formatDate } from "@/modules/crm/lib/format";

export type CrmSearchResultType = "customer" | "enquiry" | "job" | "quote" | "invoice";

export type CrmSearchResult = {
  id: string;
  type: CrmSearchResultType;
  label: string;
  meta: string;
  href: string;
  action: string;
  callHref?: string;
  callNoteHref?: string;
};

export type CrmSearchSourceData = {
  customers: CustomerWithCounts[];
  leads: LeadWithRelations[];
  jobs: JobWithRelations[];
  quotes: QuoteWithRelations[];
  invoices: InvoiceWithRelations[];
};

function cleanJoin(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => (part === null || part === undefined ? "" : String(part).trim()))
    .filter(Boolean)
    .join(" · ");
}

export function normalizeCrmSearchQuery(query: string | null | undefined) {
  return (query ?? "").trim().toLowerCase();
}

function matches(query: string, parts: Array<string | number | null | undefined>) {
  return parts.some((part) => {
    if (part === null || part === undefined) {
      return false;
    }
    return String(part).toLowerCase().includes(query);
  });
}

function telHref(phone: string | null | undefined) {
  const cleaned = phone?.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : undefined;
}

export function buildCrmSearchResults(query: string, source: CrmSearchSourceData, perTypeLimit = 5): CrmSearchResult[] {
  const normalized = normalizeCrmSearchQuery(query);
  if (normalized.length < 2) {
    return [];
  }

  const customers = source.customers
    .filter((customer) =>
      matches(normalized, [customer.full_name, customer.phone, customer.email, customer.postcode, customer.address_line1]),
    )
    .slice(0, perTypeLimit)
    .map((customer) => ({
      id: `customer:${customer.id}`,
      type: "customer" as const,
      label: customer.full_name,
      meta: cleanJoin([customer.phone, customer.email, customer.postcode, `${customer.active_job_count ?? 0} active jobs`]),
      href: `/customers/${customer.id}`,
      action: "Open customer",
      callHref: telHref(customer.phone),
      callNoteHref: `/customers/${customer.id}?call=1#customer-call-note`,
    }));

  const leads = source.leads
    .filter((lead) =>
      matches(normalized, [
        lead.customer?.full_name,
        lead.customer?.phone,
        lead.customer?.email,
        lead.customer?.postcode,
        lead.problem_description,
        lead.notes,
        lead.source,
        lead.service?.name,
        lead.job_type?.name,
      ]),
    )
    .slice(0, perTypeLimit)
    .map((lead) => ({
      id: `enquiry:${lead.id}`,
      type: "enquiry" as const,
      label: lead.customer?.full_name ?? "Unlinked enquiry",
      meta: cleanJoin([lead.problem_description ?? lead.notes, lead.source, lead.status, `Received ${formatDate(lead.created_at)}`]),
      href: `/leads?tab=all&highlight=${encodeURIComponent(lead.id)}`,
      action: "Review enquiry",
    }));

  const jobs = source.jobs
    .filter((job) =>
      matches(normalized, [
        job.title,
        job.customer?.full_name,
        job.customer?.phone,
        job.customer?.postcode,
        job.site?.label,
        job.service?.name,
        job.job_type?.name,
        job.status,
      ]),
    )
    .slice(0, perTypeLimit)
    .map((job) => ({
      id: `job:${job.id}`,
      type: "job" as const,
      label: job.title,
      meta: cleanJoin([job.customer?.full_name, job.status, job.scheduled_date ? `Scheduled ${formatDate(job.scheduled_date)}` : "No date"]),
      href: `/jobs/${job.id}`,
      action: "Open job",
    }));

  const quotes = source.quotes
    .filter((quote) =>
      matches(normalized, [quote.quote_number, quote.customer?.full_name, quote.job?.title, quote.status, quote.total]),
    )
    .slice(0, perTypeLimit)
    .map((quote) => ({
      id: `quote:${quote.id}`,
      type: "quote" as const,
      label: quote.quote_number,
      meta: cleanJoin([quote.customer?.full_name, quote.job?.title, quote.status, formatCurrency(quote.total)]),
      href: `/quotes/${quote.id}`,
      action: "Open quote",
    }));

  const invoices = source.invoices
    .filter((invoice) =>
      matches(normalized, [invoice.invoice_number, invoice.customer?.full_name, invoice.job?.title, invoice.status, invoice.total]),
    )
    .slice(0, perTypeLimit)
    .map((invoice) => ({
      id: `invoice:${invoice.id}`,
      type: "invoice" as const,
      label: invoice.invoice_number,
      meta: cleanJoin([invoice.customer?.full_name, invoice.job?.title, invoice.status, formatCurrency(invoice.total)]),
      href: `/invoices/${invoice.id}`,
      action: "Open invoice",
    }));

  return [...customers, ...leads, ...jobs, ...quotes, ...invoices];
}
