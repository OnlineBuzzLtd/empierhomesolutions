import Link from "next/link";
import { QuoteCreateForm } from "@/modules/crm/components/forms/QuoteCreateForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { formatCurrency, formatDate } from "@/modules/crm/lib/format";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { quoteStatusConfig } from "@/modules/crm/lib/status";
import { listCustomers, listJobs, listQuotes } from "@/modules/crm/lib/data";

export default async function QuotesPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const [quotes, customers, jobs] = await Promise.all([listQuotes(), listCustomers(), listJobs()]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
        <p className="mt-1 text-sm text-slate-500">{quotes.length} quotes in CRM.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <SectionCard title="Quote List">
          {quotes.length === 0 ? (
            <EmptyState message="No quotes yet." />
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {quotes.map((quote) => (
                <Link key={quote.id} href={`/quotes/${quote.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{quote.quote_number}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {quote.customer?.full_name ?? "Customer"} · {quote.job?.title ?? "Job"} · Valid until {formatDate(quote.valid_until)}
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
          <QuoteCreateForm customers={customers} jobs={jobs} />
        </SectionCard>
      </div>
    </div>
  );
}
