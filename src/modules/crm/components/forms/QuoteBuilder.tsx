"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Customer, Job, LineItem, Package, PackageItem, Product, Quote } from "@/modules/crm/types";
import { LineItemsEditorV2 } from "@/modules/crm/components/forms/LineItemsEditorV2";
import { QuoteRollupPanel } from "@/modules/crm/components/forms/QuoteRollupPanel";

export function QuoteBuilder({
  customers,
  jobs,
  products = [],
  packages = [],
  initialQuote,
  endpoint,
  method = "PATCH",
  submitLabel = "Save quote",
  showPerPackageVat = false,
}: {
  customers: Customer[];
  jobs: Job[];
  products?: Product[];
  packages?: Array<Package & { items?: PackageItem[] }>;
  initialQuote?: Partial<Quote>;
  endpoint: string;
  method?: "POST" | "PATCH";
  submitLabel?: string;
  showPerPackageVat?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<LineItem[]>(initialQuote?.line_items ?? []);
  const [vatRate, setVatRate] = useState<number>(Number(initialQuote?.vat_rate ?? 0.2));
  const [customerId, setCustomerId] = useState<string>(initialQuote?.customer_id ?? "");
  const [jobId, setJobId] = useState<string>(initialQuote?.job_id ?? "");
  const [documentType, setDocumentType] = useState<string>(initialQuote?.document_type ?? "quote");
  const [vatCategory, setVatCategory] = useState<string>(initialQuote?.vat_category ?? "standard_20");
  const [status, setStatus] = useState<string>(initialQuote?.status ?? "draft");
  const [validUntil, setValidUntil] = useState<string>(initialQuote?.valid_until ?? "");
  const initialInstallScope = (initialQuote?.install_scope ?? {}) as Record<string, unknown>;
  const initialPaymentTerms = (initialQuote?.payment_terms ?? {}) as Record<string, unknown>;
  const [boilerModel, setBoilerModel] = useState<string>(String(initialInstallScope.boiler_model ?? ""));
  const [scopeSummary, setScopeSummary] = useState<string>(String(initialInstallScope.scope_summary ?? ""));
  const [warranty, setWarranty] = useState<string>(String(initialInstallScope.warranty ?? ""));
  const [exclusions, setExclusions] = useState<string>(String(initialInstallScope.exclusions ?? ""));
  const [depositTerms, setDepositTerms] = useState<string>(String(initialPaymentTerms.deposit_terms ?? ""));
  const [paymentTerms, setPaymentTerms] = useState<string>(String(initialPaymentTerms.balance_terms ?? ""));
  const [changeSummary, setChangeSummary] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const body = {
      customer_id: customerId,
      job_id: jobId,
      document_type: documentType,
      vat_rate: vatRate,
      vat_category: vatCategory,
      status,
      valid_until: validUntil || null,
      install_scope: {
        boiler_model: boilerModel || null,
        scope_summary: scopeSummary || null,
        warranty: warranty || null,
        exclusions: exclusions || null,
      },
      payment_terms: {
        deposit_terms: depositTerms || null,
        balance_terms: paymentTerms || null,
      },
      agent_autonomy: initialQuote?.agent_autonomy ?? {},
      change_summary: changeSummary || null,
      line_items: items,
    };

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    setSubmitting(false);
    if (!response.ok) {
      setError(result.error ?? "Save failed.");
      return;
    }
    setSuccess("Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="space-y-3">
        <div className="grid gap-2 md:grid-cols-2">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}
              </option>
            ))}
          </select>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select job…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="quote">Quote</option>
            <option value="estimate">Estimate</option>
          </select>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={vatRate}
            onChange={(e) => setVatRate(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
          <select value={vatCategory} onChange={(e) => setVatCategory(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="standard_20">20% VAT</option>
            <option value="vat_exempt">VAT Exempt</option>
            <option value="reverse_charge">Reverse Charge</option>
          </select>
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="Revision summary (optional)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <LineItemsEditorV2
          initialItems={items}
          products={products}
          packages={packages}
          vatRate={vatRate}
          showPerPackageVat={showPerPackageVat}
          onChange={setItems}
        />
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
          <input
            value={boilerModel}
            onChange={(e) => setBoilerModel(e.target.value)}
            placeholder="Boiler model / package"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
            placeholder="Warranty"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={scopeSummary}
            onChange={(e) => setScopeSummary(e.target.value)}
            placeholder="Install scope"
            className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            value={exclusions}
            onChange={(e) => setExclusions(e.target.value)}
            placeholder="Exclusions"
            className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={depositTerms}
            onChange={(e) => setDepositTerms(e.target.value)}
            placeholder="Deposit terms"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="Balance payment terms"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <aside className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profit &amp; cost</p>
          <QuoteRollupPanel className="mt-3" lineItems={items} vatRate={vatRate} />
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? "Saving…" : submitLabel}
          </button>
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </div>
      </aside>
    </form>
  );
}
