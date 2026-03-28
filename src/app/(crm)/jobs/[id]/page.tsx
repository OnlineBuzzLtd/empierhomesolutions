import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { AttachmentUploadForm } from "@/modules/crm/components/forms/AttachmentUploadForm";
import { ExpenseCreateForm } from "@/modules/crm/components/forms/ExpenseCreateForm";
import { NoteCreateForm } from "@/modules/crm/components/forms/NoteCreateForm";
import { PaymentCreateForm } from "@/modules/crm/components/forms/PaymentCreateForm";
import { EngineerJobWorkspace } from "@/modules/crm/components/jobs/EngineerJobWorkspace";
import { AttachmentList } from "@/modules/crm/components/shared/AttachmentList";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { getAddonState, resolveEngineerAiAssistState } from "@/modules/crm/lib/addons";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { formatCurrency, formatDate, formatDateTime } from "@/modules/crm/lib/format";
import { getJobDetail, listSiteContacts, listSites, listStaffDirectory, listSuppliers } from "@/modules/crm/lib/data";
import { invoiceStatusConfig, jobCertificateStatusConfig, jobChecklistStatusConfig, jobHazardStatusConfig, jobPhaseStatusConfig, jobStatusConfig, jobVariationStatusConfig, purchaseOrderStatusConfig, quoteStatusConfig, supplierReconciliationStatusConfig } from "@/modules/crm/lib/status";
import { getAssignableEngineerOptions } from "@/modules/crm/lib/staff";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmUser();
  const { id } = await params;
  const demoState = await getCrmDemoState();
  const [detail, staff, sites, siteContacts, suppliers, addon] = await Promise.all([
    getJobDetail(id, demoState.mode),
    listStaffDirectory(demoState.mode),
    listSites(demoState.mode),
    listSiteContacts(demoState.mode),
    listSuppliers(demoState.mode),
    getAddonState("ai_comms_hub"),
  ]);
  if (!detail) {
    notFound();
  }

  const { job, notes, expenses, payments, attachments, quote, invoice } = detail;
  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const engineers = getAssignableEngineerOptions(staff);
  const assignedEngineerIds = new Set(job.assignees?.map((assignee) => assignee.user_profile_id) ?? []);
  const availableSites = sites.filter((site) => site.customer_id === job.customer_id);
  const availableSiteIds = new Set(availableSites.map((site) => site.id));
  const availableSiteContacts = siteContacts.filter((contact) => availableSiteIds.has(contact.site_id));
  const isEngineer = session.profile?.role === "engineer";
  const canManageCommercials = userCanManageSettings(session.profile?.role);
  const aiAssistState = resolveEngineerAiAssistState(addon, session.profile?.role, demoState.active);
  const siteAddress = [job.site?.address_line1, job.site?.city, job.site?.postcode].filter(Boolean).join(", ");
  const customerAddress = [job.customer?.address_line1, job.customer?.postcode].filter(Boolean).join(", ");
  const directionsAddress = siteAddress || customerAddress || "Address not set";
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsAddress)}`;
  const assignedEngineerLabel =
    job.assignees && job.assignees.length > 0
      ? job.assignees.map((assignee) => assignee.user_profile?.full_name ?? "Engineer").join(", ")
      : job.assigned_engineer || "Unassigned";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/jobs" className="hover:text-blue-700">
          Jobs
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{job.title}</span>
      </nav>

      <SectionCard title={job.title} action={<StatusBadge config={jobStatusConfig[job.status]} />} demoAnchor="job-record">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <p className="text-sm text-slate-700">Customer: {job.customer?.full_name ?? "Not set"}</p>
              <p className="text-sm text-slate-700">Phone: {job.customer?.phone ?? "Not set"}</p>
              <p className="text-sm text-slate-700">Site: {job.site?.label ?? "Primary customer address"}</p>
              <p className="text-sm text-slate-700">Address: {directionsAddress}</p>
              <p className="text-sm text-slate-700">Site contact: {job.site_contact?.full_name ?? "Not set"}</p>
              <p className="text-sm text-slate-700">Assigned crew: {assignedEngineerLabel}</p>
              <p className="text-sm text-slate-700">Service: {job.service?.name ?? "Not set"}</p>
              <p className="text-sm text-slate-700">Job type: {job.job_type?.name ?? "Not set"}</p>
              <p className="text-sm text-slate-700">Date: {job.scheduled_date ?? "TBC"}</p>
              <p className="text-sm text-slate-700">Time: {job.scheduled_time ?? "TBC"}</p>
            </div>
            {job.site?.access_notes || job.site?.parking_notes ? (
              <div className="grid gap-3 md:grid-cols-2">
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-slate-700">
                  <span className="block font-semibold text-slate-900">Access notes</span>
                  {job.site?.access_notes ?? "No access notes recorded."}
                </p>
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <span className="block font-semibold text-slate-900">Parking notes</span>
                  {job.site?.parking_notes ?? "No parking notes recorded."}
                </p>
              </div>
            ) : null}
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{job.description || "No job brief or access note provided."}</p>
            {isEngineer ? (
              <div className="flex flex-wrap gap-2">
                {job.customer?.phone ? (
                  <a href={`tel:${job.customer.phone.replace(/\s+/g, "")}`} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Call Customer
                  </a>
                ) : null}
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open Directions
                </a>
                <Link href="#job-notes" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Notes
                </Link>
                <Link href="#job-attachments" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Photos & Files
                </Link>
              </div>
            ) : null}
          </div>

          <ApiForm endpoint={`/api/crm/jobs/${job.id}`} method="PATCH" submitLabel="Update Job" className="grid gap-3">
            <input name="title" defaultValue={job.title} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select name="site_id" defaultValue={job.site_id ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Primary / default customer site</option>
              {availableSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.label}
                </option>
              ))}
            </select>
            <select name="site_contact_id" defaultValue={job.site_contact_id ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">No specific site contact</option>
              {availableSiteContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name} · {contact.site?.label ?? "Site"}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={job.status} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="enquiry">Enquiry</option>
              <option value="booked">Booked</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="invoiced">Invoiced</option>
            </select>
            <input name="scheduled_date" type="date" defaultValue={job.scheduled_date ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="scheduled_time" type="time" defaultValue={job.scheduled_time ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <input type="hidden" name="assigned_engineer_ids" value="" />
              <p className="text-sm font-semibold text-slate-900">Assigned engineers</p>
              <p className="mt-1 text-xs text-slate-500">Keep the office schedule and field crew aligned from the same job record.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {engineers.length === 0 ? <p className="text-sm text-slate-500">No active engineers available.</p> : null}
                {engineers.map((engineer) => (
                  <label key={engineer.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="assigned_engineer_ids"
                      value={engineer.id}
                      defaultChecked={assignedEngineerIds.has(engineer.id)}
                      className="h-4 w-4"
                    />
                    <span>{engineer.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
            <textarea name="description" defaultValue={job.description ?? ""} className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </ApiForm>
        </div>
      </SectionCard>

      {isEngineer ? (
        <EngineerJobWorkspace
          jobId={job.id}
          notes={notes}
          attachments={attachments}
          canDeleteAttachments={userCanManageSettings(session.profile?.role)}
          aiAccess={aiAssistState}
        />
      ) : (
        <div id="job-notes" className="grid gap-6 xl:grid-cols-2">
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
            <div id="job-attachments">
              <AttachmentList attachments={attachments} canDelete={userCanManageSettings(session.profile?.role)} />
              <div className="mt-4">
                <AttachmentUploadForm entityType="job" entityId={job.id} />
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {!isEngineer ? (
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
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={`Job Phases (${job.phases?.length ?? 0})`}>
          {job.phases && job.phases.length > 0 ? (
            <ul className="space-y-3">
              {job.phases.map((phase) => (
                <li key={phase.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{phase.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Target {formatDate(phase.target_date)} · Order {phase.sort_order + 1}
                      </p>
                    </div>
                    <StatusBadge config={jobPhaseStatusConfig[phase.status]} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{phase.description || "No phase detail recorded."}</p>
                  {phase.completed_at ? <p className="mt-2 text-xs text-emerald-700">Completed {formatDateTime(phase.completed_at)}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {phase.status !== "in_progress" && phase.status !== "completed" ? (
                      <ApiForm endpoint={`/api/crm/jobs/${job.id}/phases/${phase.id}`} method="PATCH" submitLabel="Start Phase" className="space-y-0">
                        <input type="hidden" name="status" value="in_progress" />
                      </ApiForm>
                    ) : null}
                    {phase.status !== "completed" ? (
                      <ApiForm endpoint={`/api/crm/jobs/${job.id}/phases/${phase.id}`} method="PATCH" submitLabel="Mark Complete" className="space-y-0">
                        <input type="hidden" name="status" value="completed" />
                      </ApiForm>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No delivery phases added yet." />
          )}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ApiForm endpoint={`/api/crm/jobs/${job.id}/phases`} submitLabel="Add Phase" className="grid gap-3 md:grid-cols-2">
              <input name="name" required placeholder="Phase name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="target_date" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select name="status" defaultValue="planned" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="planned">Planned</option>
                <option value="ready">Ready</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
              <input name="sort_order" type="number" min="0" placeholder="Sort order (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <textarea name="description" placeholder="Phase description" className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            </ApiForm>
          </div>
        </SectionCard>

        <SectionCard title={`Variations (${job.variations?.length ?? 0})`}>
          {job.variations && job.variations.length > 0 ? (
            <ul className="space-y-3">
              {job.variations.map((variation) => (
                <li key={variation.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{variation.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Raised {formatDateTime(variation.created_at)}
                        {variation.approved_at ? ` · Approved ${formatDateTime(variation.approved_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge config={jobVariationStatusConfig[variation.status]} />
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(variation.estimated_value)}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{variation.description || "No variation detail recorded."}</p>
                  {canManageCommercials && variation.status === "draft" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ApiForm endpoint={`/api/crm/jobs/${job.id}/variations/${variation.id}`} method="PATCH" submitLabel="Approve Variation" className="space-y-0">
                        <input type="hidden" name="status" value="approved" />
                        <input type="hidden" name="title" value={variation.title} />
                        <input type="hidden" name="estimated_value" value={variation.estimated_value} />
                      </ApiForm>
                      <ApiForm endpoint={`/api/crm/jobs/${job.id}/variations/${variation.id}`} method="PATCH" submitLabel="Decline Variation" className="space-y-0">
                        <input type="hidden" name="status" value="declined" />
                        <input type="hidden" name="title" value={variation.title} />
                        <input type="hidden" name="estimated_value" value={variation.estimated_value} />
                      </ApiForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No variations raised yet." />
          )}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ApiForm endpoint={`/api/crm/jobs/${job.id}/variations`} submitLabel="Raise Variation" className="grid gap-3 md:grid-cols-2">
              <input name="title" required placeholder="Variation title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="estimated_value" type="number" min="0" step="0.01" required placeholder="Estimated value" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select name="status" defaultValue="draft" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
              </select>
              <textarea name="description" placeholder="Variation detail" className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            </ApiForm>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={`Hazards (${job.hazards?.length ?? 0})`}>
          {job.hazards && job.hazards.length > 0 ? (
            <ul className="space-y-3">
              {job.hazards.map((hazard) => (
                <li key={hazard.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{hazard.title}</p>
                    <StatusBadge config={jobHazardStatusConfig[hazard.status]} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{hazard.description || "No hazard detail recorded."}</p>
                  {hazard.status !== "hazard_free" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ApiForm endpoint={`/api/crm/jobs/${job.id}/hazards/${hazard.id}`} method="PATCH" submitLabel="Mitigate" className="space-y-0">
                        <input type="hidden" name="status" value="mitigated" />
                      </ApiForm>
                      <ApiForm endpoint={`/api/crm/jobs/${job.id}/hazards/${hazard.id}`} method="PATCH" submitLabel="Mark Hazard Free" className="space-y-0">
                        <input type="hidden" name="status" value="hazard_free" />
                      </ApiForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No hazards recorded yet." />
          )}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ApiForm endpoint={`/api/crm/jobs/${job.id}/hazards`} submitLabel="Add Hazard" className="grid gap-3">
              <input name="title" required placeholder="Hazard title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <textarea name="description" placeholder="Hazard description" className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </ApiForm>
          </div>
        </SectionCard>

        <SectionCard title={`Checklists (${job.checklists?.length ?? 0})`}>
          {job.checklists && job.checklists.length > 0 ? (
            <ul className="space-y-3">
              {job.checklists.map((checklist) => (
                <li key={checklist.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{checklist.title}</p>
                      {checklist.completed_at ? <p className="mt-1 text-xs text-slate-500">Completed {formatDateTime(checklist.completed_at)}</p> : null}
                    </div>
                    <StatusBadge config={jobChecklistStatusConfig[checklist.status]} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{checklist.notes || "No checklist notes."}</p>
                  {checklist.status !== "completed" ? (
                    <div className="mt-3">
                      <ApiForm endpoint={`/api/crm/jobs/${job.id}/checklists/${checklist.id}`} method="PATCH" submitLabel="Mark Complete" className="space-y-0">
                        <input type="hidden" name="status" value="completed" />
                      </ApiForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No required checklists added yet." />
          )}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ApiForm endpoint={`/api/crm/jobs/${job.id}/checklists`} submitLabel="Add Checklist" className="grid gap-3">
              <input name="title" required placeholder="Checklist title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <textarea name="notes" placeholder="Checklist notes" className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </ApiForm>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={`Certificates (${job.certificates?.length ?? 0})`}>
          {job.certificates && job.certificates.length > 0 ? (
            <ul className="space-y-3">
              {job.certificates.map((certificate) => (
                <li key={certificate.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{certificate.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {certificate.certificate_number || "No certificate number"} · Issued {formatDate(certificate.issued_at)}
                      </p>
                    </div>
                    <StatusBadge config={jobCertificateStatusConfig[certificate.status]} />
                  </div>
                  {certificate.status !== "completed" && certificate.status !== "sent" ? (
                    <div className="mt-3">
                      <ApiForm endpoint={`/api/crm/jobs/${job.id}/certificates/${certificate.id}`} method="PATCH" submitLabel="Complete Certificate" className="space-y-0">
                        <input type="hidden" name="status" value="completed" />
                      </ApiForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No job certificates created yet." />
          )}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ApiForm endpoint={`/api/crm/jobs/${job.id}/certificates`} submitLabel="Add Certificate" className="grid gap-3 md:grid-cols-2">
              <input name="title" required placeholder="Certificate title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="certificate_number" placeholder="Certificate number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="issued_at" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select name="status" defaultValue="draft" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
                <option value="sent">Sent</option>
              </select>
            </ApiForm>
          </div>
        </SectionCard>

        <SectionCard title={`Supplier Control (${(job.purchaseOrders?.length ?? 0) + (job.supplierReconciliation?.length ?? 0)})`}>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Purchase Orders</p>
              {job.purchaseOrders && job.purchaseOrders.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {job.purchaseOrders.map((po) => (
                    <li key={po.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{po.po_number}</p>
                          <p className="mt-1 text-xs text-slate-500">{po.supplier?.name || "No supplier"} · {formatCurrency(po.total_amount)}</p>
                        </div>
                        <StatusBadge config={purchaseOrderStatusConfig[po.status]} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No purchase orders yet.</p>
              )}
              <div className="mt-3">
                <ApiForm endpoint={`/api/crm/jobs/${job.id}/purchase-orders`} submitLabel="Add Purchase Order" className="grid gap-3 md:grid-cols-2">
                  <input name="po_number" required placeholder="PO number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select name="supplier_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select supplier…</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <input name="total_amount" type="number" min="0" step="0.01" required placeholder="Total amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select name="status" defaultValue="draft" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="received">Received</option>
                    <option value="reconciled">Reconciled</option>
                  </select>
                </ApiForm>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-900">Supplier Reconciliation</p>
              {job.supplierReconciliation && job.supplierReconciliation.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {job.supplierReconciliation.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{entry.reference_number || "No reference"}</p>
                          <p className="mt-1 text-xs text-slate-500">{entry.entry_type} · {entry.supplier?.name || "No supplier"} · {formatCurrency(entry.amount)}</p>
                        </div>
                        <StatusBadge config={supplierReconciliationStatusConfig[entry.status]} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No supplier invoices or credits logged yet.</p>
              )}
              <div className="mt-3">
                <ApiForm endpoint={`/api/crm/jobs/${job.id}/supplier-reconciliation`} submitLabel="Add Supplier Entry" className="grid gap-3 md:grid-cols-2">
                  <select name="supplier_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select supplier…</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <select name="entry_type" defaultValue="invoice" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="invoice">Invoice</option>
                    <option value="credit">Credit</option>
                  </select>
                  <input name="reference_number" placeholder="Reference number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input name="amount" type="number" step="0.01" required placeholder="Amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </ApiForm>
              </div>
            </div>
          </div>
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

      {isEngineer ? (
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
      ) : null}
    </div>
  );
}
