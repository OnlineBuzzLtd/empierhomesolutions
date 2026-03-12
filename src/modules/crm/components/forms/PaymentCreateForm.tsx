import { ApiForm } from "@/modules/crm/components/forms/ApiForm";

export function PaymentCreateForm({
  customerId,
  quoteId,
  invoiceId,
}: {
  customerId: string;
  quoteId?: string | null;
  invoiceId?: string | null;
}) {
  return (
    <ApiForm endpoint="/api/crm/payments" submitLabel="Record Payment" className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="customer_id" value={customerId} />
      {quoteId ? <input type="hidden" name="quote_id" value={quoteId} /> : null}
      {invoiceId ? <input type="hidden" name="invoice_id" value={invoiceId} /> : null}
      <select name="payment_type" defaultValue="deposit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="deposit">Deposit</option>
        <option value="stage">Stage</option>
        <option value="final">Final</option>
        <option value="finance">Finance</option>
      </select>
      <select name="status" defaultValue="requested" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="requested">Requested</option>
        <option value="received">Received</option>
        <option value="failed">Failed</option>
        <option value="refunded">Refunded</option>
      </select>
      <input name="amount" type="number" min="0" step="0.01" required placeholder="Amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="reference" placeholder="Reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <textarea name="notes" placeholder="Notes" className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
    </ApiForm>
  );
}
