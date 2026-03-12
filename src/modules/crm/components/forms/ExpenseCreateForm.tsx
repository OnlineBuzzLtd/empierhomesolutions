import { ApiForm } from "@/modules/crm/components/forms/ApiForm";

export function ExpenseCreateForm({ jobId }: { jobId: string }) {
  return (
    <ApiForm endpoint="/api/crm/expenses" submitLabel="Log Expense" className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="job_id" value={jobId} />
      <input name="description" required placeholder="Description" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
      <input name="amount" required type="number" min="0" step="0.01" placeholder="Amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <select name="category" defaultValue="materials" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="materials">Materials</option>
        <option value="travel">Travel</option>
        <option value="subcontractor">Subcontractor</option>
        <option value="other">Other</option>
      </select>
    </ApiForm>
  );
}
