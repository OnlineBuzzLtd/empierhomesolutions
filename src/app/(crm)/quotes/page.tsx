import Link from "next/link";
import { QuoteCreateForm } from "@/modules/crm/components/forms/QuoteCreateForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoEmptyMessage } from "@/modules/crm/lib/demo";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { formatCurrency, formatDate } from "@/modules/crm/lib/format";
import { buildQuoteDraftFromTemplate, summarizePaymentTerms } from "@/modules/crm/lib/quote-templates";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { quoteStatusConfig } from "@/modules/crm/lib/status";
import { listCustomers, listJobs, listProducts, listQuoteTemplates, listQuotes } from "@/modules/crm/lib/data";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const demoState = await getCrmDemoState();
  const params = await searchParams;
  const templateId = typeof params.template === "string" ? params.template : null;
  const [quotes, customers, jobs, templates, products] = await Promise.all([
    listQuotes(demoState.mode),
    listCustomers(demoState.mode),
    listJobs(demoState.mode),
    listQuoteTemplates(demoState.mode),
    listProducts(demoState.mode),
  ]);
  const selectedTemplate = templateId ? templates.find((template) => template.id === templateId) ?? null : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
        <p className="mt-1 text-sm text-slate-500">{quotes.length} quotes in CRM.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <SectionCard title="Quote List" demoAnchor="quote-record">
          {quotes.length === 0 ? (
            <EmptyState message={demoState.active ? getCrmDemoEmptyMessage("quotes") : "No quotes yet."} />
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {quotes.map((quote) => (
                <Link key={quote.id} href={`/quotes/${quote.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{quote.quote_number}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {(quote.document_type === "estimate" ? "Estimate" : "Quote")} · {quote.customer?.full_name ?? "Customer"} · {quote.job?.title ?? "Job"} · v{quote.current_version_number} · Valid until {formatDate(quote.valid_until)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge config={quoteStatusConfig[quote.status]} />
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(quote.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Create Quote">
          <div className="mb-4 flex flex-wrap gap-2">
            <Link href="/quotes" className={`rounded-full px-3 py-1.5 text-xs font-medium ${selectedTemplate ? "border border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-slate-900 text-white"}`}>
              Blank quote
            </Link>
            {templates.map((template) => (
              <Link
                key={template.id}
                href={`/quotes?template=${template.id}`}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${selectedTemplate?.id === template.id ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {template.name}
              </Link>
            ))}
          </div>
          <QuoteCreateForm
            customers={customers}
            jobs={jobs}
            products={products}
            initialQuote={buildQuoteDraftFromTemplate(selectedTemplate)}
            optionalExtras={selectedTemplate?.optional_extras ?? []}
            paymentTermsSummary={summarizePaymentTerms(selectedTemplate?.payment_terms)}
            templateLabel={selectedTemplate?.name ?? null}
          />
        </SectionCard>
      </div>
    </div>
  );
}
