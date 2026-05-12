import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiActionButton } from "@/modules/crm/components/forms/ApiActionButton";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { AttachmentUploadForm } from "@/modules/crm/components/forms/AttachmentUploadForm";
import { QuoteBuilder } from "@/modules/crm/components/forms/QuoteBuilder";
import { PaymentPlanEditor } from "@/modules/crm/components/forms/PaymentPlanEditor";
import { PublicLinkPanel } from "@/modules/crm/components/forms/PublicLinkPanel";
import { AttachmentList } from "@/modules/crm/components/shared/AttachmentList";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/modules/crm/lib/format";
import { getQuoteDetail, listAttachmentsForEntity, listCustomers, listJobs, listProducts } from "@/modules/crm/lib/data";
import { invoiceScheduleStatusConfig, quoteStatusConfig } from "@/modules/crm/lib/status";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import type { Package, PackageItem } from "@/modules/crm/types";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmUser();
  const { id } = await params;
  const supabase = await createCrmServerClient();
  const [quote, attachments, customers, jobs, products, packagesQuery, tenantSettingsQuery] = await Promise.all([
    getQuoteDetail(id),
    listAttachmentsForEntity("quote", id),
    listCustomers(),
    listJobs(),
    listProducts(),
    supabase
      .schema("crm")
      .from("packages")
      .select("*, items:package_items(*)")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .schema("crm")
      .from("tenant_settings")
      .select("show_per_package_vat")
      .eq("tenant_id", session.tenant!.id)
      .maybeSingle(),
  ]);
  if (!quote) {
    notFound();
  }
  const packages = (packagesQuery.data ?? []) as Array<Package & { items?: PackageItem[] }>;
  const showPerPackageVat = Boolean(tenantSettingsQuery.data?.show_per_package_vat);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/quotes" className="hover:text-blue-700">
          Quotes
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{quote.quote_number}</span>
      </nav>

      <SectionCard title={quote.quote_number} action={<StatusBadge config={quoteStatusConfig[quote.status]} />} demoAnchor="quote-record">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{quote.customer?.full_name}</p>
            <p className="mt-1 text-sm text-slate-600">{quote.customer?.address_line1}</p>
            <p className="text-sm text-slate-600">{quote.customer?.postcode}</p>
            <p className="mt-3 text-sm text-slate-600">
              {(quote.document_type === "estimate" ? "Estimate" : "Quote")} · v{quote.current_version_number} · Valid until {formatDate(quote.valid_until)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <a href={`/api/crm/quotes/${quote.id}/pdf`} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Download PDF
            </a>
            {quote.status === "draft" ? (
              <ApiActionButton
                endpoint={`/api/crm/quotes/${quote.id}/send`}
                label="Mark Sent"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              />
            ) : null}
            <ApiActionButton
              endpoint={`/api/crm/quotes/${quote.id}/convert`}
              label="Convert to Invoice"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quote.line_items.map((item, index) => (
                <tr key={`${item.description}-${index}`}>
                  <td className="py-3 text-slate-800">{item.description}</td>
                  <td className="py-3 text-right text-slate-600">{item.qty}</td>
                  <td className="py-3 text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 text-right font-semibold text-slate-900">{formatCurrency(item.qty * item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 max-w-xs space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-900">{formatCurrency(quote.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">VAT</span>
            <span className="text-slate-900">{formatCurrency(quote.subtotal * quote.vat_rate)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(quote.total)}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Quote Builder" demoAnchor="quote-builder">
        <QuoteBuilder
          customers={customers}
          jobs={jobs}
          products={products}
          packages={packages}
          initialQuote={quote}
          endpoint={`/api/crm/quotes/${quote.id}`}
          submitLabel="Save new version"
          showPerPackageVat={showPerPackageVat}
        />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Payment plan">
          <PaymentPlanEditor
            quoteId={quote.id}
            quoteTotal={Number(quote.total ?? 0)}
            initialDepositPercent={25}
            initialStages={[]}
            initialFinalDays={30}
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Public preview link">
            <PublicLinkPanel
              quoteId={quote.id}
              initialToken={quote.public_token ?? null}
              initialExpiresAt={quote.public_token_expires_at ?? null}
            />
          </SectionCard>

          <SectionCard title="Acceptance">
            {quote.acceptance ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-emerald-800">Accepted by {quote.acceptance.accepted_by_name}</p>
                <p className="mt-1 text-slate-600">
                  {quote.acceptance.acceptance_method}
                  {quote.acceptance.accepted_by_email ? ` · ${quote.acceptance.accepted_by_email}` : ""}
                </p>
                <p className="mt-1 text-slate-600">Accepted {formatDateTime(quote.acceptance.accepted_at)}</p>
                {quote.acceptance.notes ? <p className="mt-2 text-slate-700">{quote.acceptance.notes}</p> : null}
              </div>
            ) : (
              <ApiForm endpoint={`/api/crm/quotes/${quote.id}/accept`} submitLabel="Record Acceptance" className="grid gap-3">
                <input name="accepted_by_name" required placeholder="Accepted by" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name="accepted_by_email" type="email" placeholder="Email (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name="acceptance_method" defaultValue="Phone confirmation" placeholder="Acceptance method" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <textarea name="notes" placeholder="Notes" className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </ApiForm>
            )}
          </SectionCard>

          <SectionCard title={`Version History (${quote.versions?.length ?? 0})`}>
            {quote.versions && quote.versions.length > 0 ? (
              <ul className="space-y-3">
                {quote.versions.map((version) => (
                  <li key={version.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">v{version.version_number}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(version.created_at)}</p>
                      </div>
                      <StatusBadge config={quoteStatusConfig[version.status]} />
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{version.document_type}</p>
                    <p className="mt-2 text-sm text-slate-700">{version.change_summary || "No revision note recorded."}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No revisions recorded yet." />
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title={`Invoice Schedule (${quote.invoiceSchedules?.length ?? 0})`}>
        {quote.invoiceSchedules && quote.invoiceSchedules.length > 0 ? (
          <ul className="space-y-3">
            {quote.invoiceSchedules.map((schedule) => {
              const amountLabel =
                schedule.percentage !== null ? `${Number(schedule.percentage).toFixed(2)}% of quote` : formatCurrency(Number(schedule.fixed_amount ?? 0));
              return (
                <li key={schedule.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{schedule.label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {schedule.payment_type} · {amountLabel} · Due {schedule.due_offset_days} days after issue
                      </p>
                    </div>
                    <StatusBadge config={invoiceScheduleStatusConfig[schedule.status]} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {schedule.invoice_id ? (
                      <Link href={`/invoices/${schedule.invoice_id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        View Invoice
                      </Link>
                    ) : (
                      <ApiActionButton
                        endpoint={`/api/crm/invoice-schedules/${schedule.id}/generate`}
                        label="Generate Invoice"
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState message="No staged billing schedule created yet." />
        )}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <ApiForm endpoint={`/api/crm/quotes/${quote.id}/invoice-schedules`} submitLabel="Add Invoice Stage" className="grid gap-3 md:grid-cols-2">
            <input name="label" required placeholder="Deposit / Stage / Final" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select name="payment_type" defaultValue="stage" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="deposit">Deposit</option>
              <option value="stage">Stage</option>
              <option value="final">Final</option>
              <option value="finance">Finance</option>
            </select>
            <input name="percentage" type="number" min="0" max="100" step="0.01" placeholder="Percentage of quote" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="fixed_amount" type="number" min="0" step="0.01" placeholder="Or fixed amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="due_offset_days" type="number" min="0" defaultValue={14} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </ApiForm>
        </div>
      </SectionCard>

      <SectionCard title={`Attachments (${attachments.length})`}>
        <AttachmentList
          attachments={attachments}
          canDelete={userCanManageSettings(session.profile?.role)}
          emptyMessage="No quote attachments yet."
        />
        <div className="mt-4">
          <AttachmentUploadForm entityType="quote" entityId={quote.id} />
        </div>
      </SectionCard>
    </div>
  );
}
