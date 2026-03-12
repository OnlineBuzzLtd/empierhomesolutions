import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { AttachmentUploadForm } from "@/modules/crm/components/forms/AttachmentUploadForm";
import { ExpenseCreateForm } from "@/modules/crm/components/forms/ExpenseCreateForm";
import { NoteCreateForm } from "@/modules/crm/components/forms/NoteCreateForm";
import { PaymentCreateForm } from "@/modules/crm/components/forms/PaymentCreateForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/modules/crm/lib/format";
import { getJobDetail } from "@/modules/crm/lib/data";
import { invoiceStatusConfig, jobStatusConfig, quoteStatusConfig } from "@/modules/crm/lib/status";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCrmUser();
  const { id } = await params;
  const detail = await getJobDetail(id);
  if (!detail) {
    notFound();
  }

  const { job, notes, expenses, payments, attachments, quote, invoice } = detail;
  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/jobs" className="hover:text-blue-700">
          Jobs
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{job.title}</span>
      </nav>

      <SectionCard title={job.title} action={<StatusBadge config={jobStatusConfig[job.status]} />}>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{job.description || "No description provided."}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <p className="text-sm text-slate-700">Customer: {job.customer?.full_name ?? "Not set"}</p>
              <p className="text-sm text-slate-700">Engineer: {job.assigned_engineer || "Unassigned"}</p>
              <p className="text-sm text-slate-700">Service: {job.service?.name ?? "Not set"}</p>
              <p className="text-sm text-slate-700">Job type: {job.job_type?.name ?? "Not set"}</p>
              <p className="text-sm text-slate-700">Date: {job.scheduled_date ?? "TBC"}</p>
              <p className="text-sm text-slate-700">Time: {job.scheduled_time ?? "TBC"}</p>
            </div>
          </div>

          <ApiForm endpoint={`/api/crm/jobs/${job.id}`} method="PATCH" submitLabel="Update Job" className="grid gap-3">
            <input name="title" defaultValue={job.title} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select name="status" defaultValue={job.status} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="enquiry">Enquiry</option>
              <option value="booked">Booked</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="invoiced">Invoiced</option>
            </select>
            <input name="assigned_engineer" defaultValue={job.assigned_engineer ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="scheduled_date" type="date" defaultValue={job.scheduled_date ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="scheduled_time" type="time" defaultValue={job.scheduled_time ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="description" defaultValue={job.description ?? ""} className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </ApiForm>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Quote">
          {quote ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <Link href={`/quotes/${quote.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700">
                  {quote.quote_number}
                </Link>
                <StatusBadge config={quoteStatusConfig[quote.status]} />
              </div>
              <p className="text-sm text-slate-600">Total {formatCurrency(quote.total)}</p>
            </div>
          ) : (
            <EmptyState message="No quote linked yet." />
          )}
        </SectionCard>

        <SectionCard title="Invoice">
          {invoice ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <Link href={`/invoices/${invoice.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700">
                  {invoice.invoice_number}
                </Link>
                <StatusBadge config={invoiceStatusConfig[invoice.status]} />
              </div>
              <p className="text-sm text-slate-600">Due {formatDate(invoice.due_date)}</p>
            </div>
          ) : (
            <EmptyState message="No invoice linked yet." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={`Expenses (${expenses.length})`}>
          {expenses.length === 0 ? <EmptyState message="No expenses logged." /> : null}
          <ul className="space-y-2">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{expense.description}</p>
                  <p className="text-xs capitalize text-slate-500">{expense.category}</p>
                </div>
                <span className="font-semibold text-slate-900">{formatCurrency(expense.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-semibold text-slate-900">Total expenses: {formatCurrency(expenseTotal)}</p>
          <div className="mt-4">
            <ExpenseCreateForm jobId={job.id} />
          </div>
        </SectionCard>

        <SectionCard title={`Payments (${payments.length})`}>
          {payments.length === 0 ? <EmptyState message="No payments recorded." /> : null}
          <ul className="space-y-2">
            {payments.map((payment) => (
              <li key={payment.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{payment.payment_type}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(payment.amount)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {payment.status} · {payment.reference || "No reference"}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <PaymentCreateForm customerId={job.customer_id} quoteId={quote?.id} invoiceId={invoice?.id} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={`Notes (${notes.length})`}>
          {notes.length === 0 ? <EmptyState message="No notes yet." /> : null}
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-800">{note.body}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(note.created_at)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <NoteCreateForm entityType="job" entityId={job.id} />
          </div>
        </SectionCard>

        <SectionCard title={`Attachments (${attachments.length})`}>
          {attachments.length === 0 ? <EmptyState message="No attachments yet." /> : null}
          <ul className="space-y-2">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
                {attachment.file_name} · {attachment.file_type}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <AttachmentUploadForm entityType="job" entityId={job.id} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
