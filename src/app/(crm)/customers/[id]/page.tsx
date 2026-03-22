import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { AttachmentUploadForm } from "@/modules/crm/components/forms/AttachmentUploadForm";
import { NoteCreateForm } from "@/modules/crm/components/forms/NoteCreateForm";
import { AttachmentList } from "@/modules/crm/components/shared/AttachmentList";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { formatDate, formatDateTime } from "@/modules/crm/lib/format";
import { getCustomerDetail } from "@/modules/crm/lib/data";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmUser();
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) {
    notFound();
  }

  const { customer, jobs, notes, assets, attachments } = detail;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/customers" className="hover:text-blue-700">
          Customers
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{customer.full_name}</span>
      </nav>

      <SectionCard title={customer.full_name} demoAnchor="customer-record">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Customer since {formatDate(customer.created_at)}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <p className="text-sm text-slate-700">Phone: {customer.phone || "Not set"}</p>
              <p className="text-sm text-slate-700">Email: {customer.email || "Not set"}</p>
              <p className="text-sm text-slate-700">Postcode: {customer.postcode || "Not set"}</p>
              <p className="text-sm text-slate-700">Source: {customer.source || "Not set"}</p>
            </div>
            <p className="text-sm text-slate-700">Address: {[customer.address_line1, customer.address_line2, customer.city].filter(Boolean).join(", ") || "Not set"}</p>
            <p className="text-sm text-slate-700">Notes: {customer.notes || "No notes"}</p>
          </div>

          <ApiForm endpoint={`/api/crm/customers/${customer.id}`} method="PATCH" submitLabel="Update Customer" className="grid gap-3">
            <input name="full_name" defaultValue={customer.full_name} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="phone" defaultValue={customer.phone ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="email" defaultValue={customer.email ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="address_line1" defaultValue={customer.address_line1 ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="city" defaultValue={customer.city ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="postcode" defaultValue={customer.postcode ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="notes" defaultValue={customer.notes ?? ""} className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </ApiForm>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={`Jobs (${jobs.length})`}>
          {jobs.length === 0 ? (
            <EmptyState message="No jobs linked to this customer yet." />
          ) : (
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{job.scheduled_date || "TBC"} · {job.assigned_engineer || "Unassigned"}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={`Assets (${assets.length})`}>
          {assets.length === 0 ? (
            <EmptyState message="No tracked assets for this customer yet." />
          ) : (
            <ul className="space-y-3">
              {assets.map((asset) => (
                <li key={asset.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">{asset.asset_type}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[asset.make, asset.model, asset.serial_number].filter(Boolean).join(" · ") || "No model details"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Service due {formatDate(asset.service_due_date)} · Warranty ends {formatDate(asset.warranty_end_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
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
            <NoteCreateForm entityType="customer" entityId={customer.id} />
          </div>
        </SectionCard>

        <SectionCard title={`Attachments (${attachments.length})`}>
          <AttachmentList attachments={attachments} canDelete={userCanManageSettings(session.profile?.role)} />
          <div className="mt-4">
            <AttachmentUploadForm entityType="customer" entityId={customer.id} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
