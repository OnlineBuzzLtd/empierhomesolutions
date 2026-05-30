import { Suspense } from "react";
import Link from "next/link";
import { QuotesClientPanel } from "@/modules/crm/components/client/CrmHotListPanels";
import { QuoteCreateForm } from "@/modules/crm/components/forms/QuoteCreateForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { buildQuoteDraftFromTemplate, summarizePaymentTerms } from "@/modules/crm/lib/quote-templates";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { listCustomers, listJobs, listProducts, listQuoteTemplates } from "@/modules/crm/lib/data";
import { crmPaginationFromSearchParams } from "@/modules/crm/lib/performance";
import type { CrmMode } from "@/modules/crm/lib/demo";

async function QuoteCreatePanel({ mode, templateId }: { mode: CrmMode; templateId: string | null }) {
  const [customers, jobs, templates, products] = await Promise.all([
    listCustomers(mode, { pageSize: 100 }),
    listJobs(mode, { pageSize: 100 }),
    listQuoteTemplates(mode),
    listProducts(mode),
  ]);
  const selectedTemplate = templateId ? templates.find((template) => template.id === templateId) ?? null : null;

  return (
    <SectionCard title="New Quote">
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
  );
}

function wantsCreatePanel(params: Record<string, string | string[] | undefined>) {
  return params.new === "1" || typeof params.template === "string";
}

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
  const pagination = crmPaginationFromSearchParams(params);
  const templateId = typeof params.template === "string" ? params.template : null;
  const showCreatePanel = wantsCreatePanel(params);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
        <p className="mt-1 text-sm text-slate-500">Create quotes, send them to customers, and chase decisions.</p>
      </div>

      <div className={showCreatePanel ? "grid gap-6 xl:grid-cols-[1.4fr_0.9fr]" : "space-y-6"}>
        <Suspense fallback={<SectionCard title="Quotes"><p className="text-sm text-slate-500">Loading quotes...</p></SectionCard>}>
          <QuotesClientPanel
            pagination={pagination}
            params={params}
            showCreatePanel={showCreatePanel}
            demoActive={demoState.active}
          />
        </Suspense>

        {showCreatePanel ? (
          <Suspense fallback={<SectionCard title="New Quote"><p className="text-sm text-slate-500">Loading form...</p></SectionCard>}>
            <QuoteCreatePanel mode={demoState.mode} templateId={templateId} />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}
