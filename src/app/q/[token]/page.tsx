import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { formatCurrency, formatDate } from "@/modules/crm/lib/format";
import type { LineItem, PublicQuoteView } from "@/modules/crm/types";
import { PublicQuoteActions } from "./PublicQuoteActions";

export const dynamic = "force-dynamic";

async function fetchPublicQuote(token: string): Promise<PublicQuoteView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const supabase = await createCrmServerClient();
  const { data } = await supabase.schema("crm").rpc("quote_by_public_token", { p_token: token });
  if (!data) return null;
  return data as PublicQuoteView;
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await fetchPublicQuote(token);
  if (!quote) {
    notFound();
  }

  void (await headers()); // ensure headers initialised for security middleware

  const subtotal = Number(quote.subtotal ?? 0);
  const total = Number(quote.total ?? 0);
  const vat = total - subtotal;
  const lineItems = (quote.line_items ?? []) as LineItem[];

  return (
    <main className="min-h-screen bg-slate-100 py-12">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl bg-white p-8 shadow">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {quote.document_type === "estimate" ? "Estimate" : "Quote"} · {quote.tenant_name ?? ""}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{quote.quote_number}</h1>
          {quote.customer_name ? <p className="mt-1 text-sm text-slate-600">For {quote.customer_name}</p> : null}
          {quote.valid_until ? (
            <p className="mt-1 text-sm text-slate-600">Valid until {formatDate(quote.valid_until)}</p>
          ) : null}
        </header>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Line items</h2>
          <ul className="mt-3 space-y-1">
            {lineItems.map((item, i) => {
              const isSection = item.kind === "section_header";
              const isPackageRollup = item.kind === "package_rollup" || item.package_role === "rollup";
              if (isSection) {
                return (
                  <li key={i} className="border-t border-slate-200 pt-3 text-sm font-bold uppercase tracking-wider text-slate-700">
                    {item.description}
                  </li>
                );
              }
              const lineTotal = Number(item.qty) * Number(item.unit_price);
              return (
                <li
                  key={i}
                  className={`flex items-baseline justify-between gap-4 py-1 text-sm ${
                    isPackageRollup ? "font-semibold text-slate-900" : item.package_role === "component" ? "pl-6 text-slate-600" : "text-slate-800"
                  }`}
                >
                  <span>
                    {item.description}
                    {isPackageRollup ? null : <span className="ml-2 text-xs text-slate-400">× {Number(item.qty)}</span>}
                  </span>
                  {isPackageRollup ? null : <span>{formatCurrency(lineTotal)}</span>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="ml-auto max-w-xs space-y-1 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">VAT</span>
            <span>{formatCurrency(vat)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </section>

        {quote.invoice_schedules && quote.invoice_schedules.length > 0 ? (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Payment plan</h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {quote.invoice_schedules.map((s, i) => {
                const amount =
                  s.percentage !== null
                    ? `${Number(s.percentage).toFixed(2)}%`
                    : formatCurrency(Number(s.fixed_amount ?? 0));
                return (
                  <li key={i} className="flex justify-between">
                    <span>
                      {s.label} <span className="text-xs text-slate-400">({s.payment_type})</span>
                    </span>
                    <span>
                      {amount} · due in {s.due_offset_days}d
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <PublicQuoteActions token={token} status={quote.status} />
      </div>
    </main>
  );
}
