import Link from "next/link";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { ExpenseCreateForm } from "@/modules/crm/components/forms/ExpenseCreateForm";
import { CompleteJobButton } from "@/modules/crm/components/jobs/CompleteJobButton";
import { EngineerJobWorkspace } from "@/modules/crm/components/jobs/EngineerJobWorkspace";
import { JobStatusActionButton } from "@/modules/crm/components/dashboard/JobStatusActionButton";
import { CollapsibleSectionCard } from "@/modules/crm/components/shared/CollapsibleSectionCard";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { formatCurrency, formatDate, formatDateTime } from "@/modules/crm/lib/format";
import {
  invoiceStatusConfig,
  jobCertificateStatusConfig,
  jobChecklistStatusConfig,
  jobHazardStatusConfig,
  jobPhaseStatusConfig,
  jobStatusConfig,
  quoteStatusConfig,
} from "@/modules/crm/lib/status";
import type {
  Attachment,
  EngineerAiAssistState,
  Expense,
  Invoice,
  JobWithRelations,
  Note,
  Payment,
  Quote,
} from "@/modules/crm/types";

export function EngineerFieldView({
  job,
  notes,
  attachments,
  expenses,
  payments,
  quote,
  invoice,
  aiAccess,
  canDeleteAttachments,
}: {
  job: JobWithRelations;
  notes: Note[];
  attachments: Attachment[];
  expenses: Expense[];
  payments: Payment[];
  quote: Quote | null;
  invoice: Invoice | null;
  aiAccess: EngineerAiAssistState;
  canDeleteAttachments: boolean;
}) {
  const endpoint = `/api/crm/jobs/${job.id}`;
  const siteAddress = [job.site?.address_line1, job.site?.city, job.site?.postcode].filter(Boolean).join(", ");
  const customerAddress = [job.customer?.address_line1, job.customer?.postcode].filter(Boolean).join(", ");
  const directionsAddress = siteAddress || customerAddress || "Address not set";
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsAddress)}`;
  // EHS-V-001 badge: voice bookings can confirm without a postcode (the
  // CJ runtime drops postcode from required-identity for voice because
  // UK postcodes are unreliable over ASR). Engineers should phone-confirm
  // the address before dispatch.
  const postcodeNeedsVerification = !job.site?.postcode && !job.customer?.postcode;
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const pendingMandatoryChecklists = (job.checklists ?? []).filter(
    (c) => c.is_mandatory && c.status !== "completed",
  ).length;
  const activeHazards = (job.hazards ?? []).filter((h) => h.status !== "hazard_free").length;
  const allChecklistsDone =
    (job.checklists ?? []).length > 0 && (job.checklists ?? []).every((c) => c.status === "completed");

  const isStartable = job.status === "booked" || job.status === "enquiry";
  const isInProgress = job.status === "in_progress";
  const isDone = job.status === "completed" || job.status === "invoiced";

  return (
    <div className="space-y-4">
      {/* Status banner + primary CTA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
            <div className="mt-1.5">
              <StatusBadge config={jobStatusConfig[job.status]} />
            </div>
          </div>
          {job.started_at ? (
            <p className="text-right text-xs text-slate-400">
              Started<br />
              <span className="font-medium text-slate-600">{formatDateTime(job.started_at)}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {isStartable ? (
            <JobStatusActionButton
              endpoint={endpoint}
              status="in_progress"
              label="Start Job"
              successLabel="In Progress ✓"
              className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-bold text-white hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            />
          ) : isInProgress ? (
            <CompleteJobButton
              endpoint={endpoint}
              className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-base font-bold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            />
          ) : isDone ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-4 text-base font-bold text-emerald-700">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Job {job.status === "invoiced" ? "Invoiced" : "Completed"}
            </div>
          ) : null}

          <div className="flex gap-2">
            {job.customer?.phone ? (
              <a
                href={`tel:${job.customer.phone.replace(/\s+/g, "")}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <PhoneIcon />
                Call Customer
              </a>
            ) : null}
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <PinIcon />
              Directions
            </a>
          </div>
        </div>
      </div>

      {/* Job info card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job Details</p>
        <dl className="mt-3 divide-y divide-slate-100">
          <InfoRow label="Customer" value={job.customer?.full_name ?? "Not set"} />
          <InfoRow label="Phone" value={job.customer?.phone ?? "Not set"} />
          <InfoRow label="Address" value={directionsAddress} />
          {postcodeNeedsVerification ? (
            <div className="border-t border-slate-100 py-3">
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                <span aria-hidden className="text-base leading-none text-amber-600">⚠</span>
                <div className="text-xs">
                  <p className="font-semibold text-amber-900">Postcode not captured</p>
                  <p className="mt-0.5 text-amber-800">
                    Booking arrived without a postcode (typically voice — UK postcodes are unreliable over ASR).
                    Phone the customer to confirm the address before dispatch.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {job.site_contact ? <InfoRow label="Site contact" value={job.site_contact.full_name} /> : null}
          <InfoRow label="Date" value={job.scheduled_date ? formatDate(job.scheduled_date) : "TBC"} />
          <InfoRow label="Time" value={job.scheduled_time ?? "TBC"} />
          {job.service?.name ? (
            <InfoRow
              label="Service"
              value={`${job.service.name}${job.job_type?.name ? ` · ${job.job_type.name}` : ""}`}
            />
          ) : null}
        </dl>

        {job.description ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            {job.description}
          </p>
        ) : null}

        {job.site?.access_notes ? (
          <div className="mt-3 rounded-xl bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-800">Access notes</p>
            <p className="mt-1 text-sm text-slate-700">{job.site.access_notes}</p>
          </div>
        ) : null}

        {job.site?.parking_notes ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-700">Parking notes</p>
            <p className="mt-1 text-sm text-slate-600">{job.site.parking_notes}</p>
          </div>
        ) : null}
      </div>

      {/* Field sections — all collapsed by default */}
      <div className="space-y-3">

        {/* 1. Checklists */}
        <CollapsibleSectionCard
          title="Checklists"
          action={
            pendingMandatoryChecklists > 0 ? (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                {pendingMandatoryChecklists} required
              </span>
            ) : allChecklistsDone ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                All done
              </span>
            ) : undefined
          }
          defaultOpen={false}
        >
          {job.checklists && job.checklists.length > 0 ? (
            <ul className="space-y-3">
              {job.checklists.map((checklist) => (
                <li
                  key={checklist.id}
                  className={`rounded-xl border p-4 ${
                    checklist.is_mandatory && checklist.status !== "completed"
                      ? "border-rose-200 bg-rose-50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{checklist.title}</p>
                      {checklist.is_mandatory && checklist.status !== "completed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
                            <path d="M5 1a4 4 0 1 0 0 8A4 4 0 0 0 5 1zm0 1.5a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0v-2A.75.75 0 0 1 5 2.5zm0 5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
                          </svg>
                          Mandatory
                        </span>
                      ) : null}
                    </div>
                    <div className="flex-shrink-0">
                      <StatusBadge config={jobChecklistStatusConfig[checklist.status]} />
                    </div>
                  </div>
                  {checklist.notes ? (
                    <p className="mt-2 text-sm text-slate-600">{checklist.notes}</p>
                  ) : null}
                  {checklist.completed_at ? (
                    <p className="mt-1 text-xs text-emerald-700">Completed {formatDateTime(checklist.completed_at)}</p>
                  ) : null}
                  {checklist.status !== "completed" ? (
                    <div className="mt-3">
                      <ApiForm
                        endpoint={`/api/crm/jobs/${job.id}/checklists/${checklist.id}`}
                        method="PATCH"
                        submitLabel="Mark Complete"
                        className="space-y-0"
                      >
                        <input type="hidden" name="status" value="completed" />
                      </ApiForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No checklists assigned to this job." />
          )}
        </CollapsibleSectionCard>

        {/* 2. Hazards */}
        <CollapsibleSectionCard
          title="Hazards"
          action={
            activeHazards > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                {activeHazards} active
              </span>
            ) : undefined
          }
          defaultOpen={false}
        >
          {job.hazards && job.hazards.length > 0 ? (
            <ul className="space-y-3">
              {job.hazards.map((hazard) => (
                <li
                  key={hazard.id}
                  className={`rounded-xl border p-4 ${
                    hazard.status !== "hazard_free" ? "border-amber-200 bg-amber-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{hazard.title}</p>
                    <StatusBadge config={jobHazardStatusConfig[hazard.status]} />
                  </div>
                  {hazard.description ? (
                    <p className="mt-2 text-sm text-slate-600">{hazard.description}</p>
                  ) : null}
                  {hazard.status !== "hazard_free" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ApiForm
                        endpoint={`/api/crm/jobs/${job.id}/hazards/${hazard.id}`}
                        method="PATCH"
                        submitLabel="Mitigate"
                        className="space-y-0"
                      >
                        <input type="hidden" name="status" value="mitigated" />
                      </ApiForm>
                      <ApiForm
                        endpoint={`/api/crm/jobs/${job.id}/hazards/${hazard.id}`}
                        method="PATCH"
                        submitLabel="Mark Hazard Free"
                        className="space-y-0"
                      >
                        <input type="hidden" name="status" value="hazard_free" />
                      </ApiForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No hazards recorded." />
          )}
        </CollapsibleSectionCard>

        {/* 3. Job Phases */}
        <CollapsibleSectionCard title={`Job Phases (${job.phases?.length ?? 0})`} defaultOpen={false}>
          {job.phases && job.phases.length > 0 ? (
            <ul className="space-y-3">
              {job.phases.map((phase) => (
                <li key={phase.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{phase.name}</p>
                      {phase.target_date ? (
                        <p className="mt-0.5 text-xs text-slate-500">Target {formatDate(phase.target_date)}</p>
                      ) : null}
                    </div>
                    <StatusBadge config={jobPhaseStatusConfig[phase.status]} />
                  </div>
                  {phase.description ? (
                    <p className="mt-2 text-sm text-slate-600">{phase.description}</p>
                  ) : null}
                  {phase.completed_at ? (
                    <p className="mt-1 text-xs text-emerald-700">Completed {formatDateTime(phase.completed_at)}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {phase.status !== "in_progress" && phase.status !== "completed" ? (
                      <ApiForm
                        endpoint={`/api/crm/jobs/${job.id}/phases/${phase.id}`}
                        method="PATCH"
                        submitLabel="Start Phase"
                        className="space-y-0"
                      >
                        <input type="hidden" name="status" value="in_progress" />
                      </ApiForm>
                    ) : null}
                    {phase.status !== "completed" ? (
                      <ApiForm
                        endpoint={`/api/crm/jobs/${job.id}/phases/${phase.id}`}
                        method="PATCH"
                        submitLabel="Mark Complete"
                        className="space-y-0"
                      >
                        <input type="hidden" name="status" value="completed" />
                      </ApiForm>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No phases added to this job." />
          )}
        </CollapsibleSectionCard>

        {/* 4. Notes & Photos */}
        <CollapsibleSectionCard
          title={`Notes & Photos (${notes.length + attachments.length})`}
          defaultOpen={false}
        >
          <EngineerJobWorkspace
            jobId={job.id}
            notes={notes}
            attachments={attachments}
            canDeleteAttachments={canDeleteAttachments}
            aiAccess={aiAccess}
          />
        </CollapsibleSectionCard>

        {/* 5. Certificates */}
        <CollapsibleSectionCard title={`Certificates (${job.certificates?.length ?? 0})`} defaultOpen={false}>
          {job.certificates && job.certificates.length > 0 ? (
            <ul className="space-y-3">
              {job.certificates.map((cert) => (
                <li key={cert.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{cert.title}</p>
                      {cert.certificate_number ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {cert.certificate_number} · Issued {formatDate(cert.issued_at)}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge config={jobCertificateStatusConfig[cert.status]} />
                  </div>
                  {cert.status !== "completed" && cert.status !== "sent" ? (
                    <div className="mt-3">
                      <ApiForm
                        endpoint={`/api/crm/jobs/${job.id}/certificates/${cert.id}`}
                        method="PATCH"
                        submitLabel="Complete Certificate"
                        className="space-y-0"
                      >
                        <input type="hidden" name="status" value="completed" />
                      </ApiForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No certificates on this job." />
          )}
        </CollapsibleSectionCard>

        {/* 6. Expenses */}
        <CollapsibleSectionCard title={`Expenses (${expenses.length})`} defaultOpen={false}>
          {expenses.length > 0 ? (
            <>
              <ul className="space-y-2">
                {expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{expense.description}</p>
                      <p className="text-xs capitalize text-slate-500">{expense.category}</p>
                    </div>
                    <span className="font-semibold text-slate-900">{formatCurrency(expense.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-semibold text-slate-900">Total: {formatCurrency(expenseTotal)}</p>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <ExpenseCreateForm jobId={job.id} />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <EmptyState message="No expenses logged yet." />
              <ExpenseCreateForm jobId={job.id} />
            </div>
          )}
        </CollapsibleSectionCard>
      </div>

      {/* Commercial — compact summary card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Commercial</p>

        <div className="mt-4 space-y-4">
          {/* Payments */}
          <div>
            <p className="text-xs font-semibold text-slate-700">
              Payments ({payments.length})
            </p>
            {payments.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-medium capitalize text-slate-800">{payment.payment_type}</span>
                      <span className="ml-2 text-xs text-slate-500">{payment.status}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{formatCurrency(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-slate-400">No payments recorded.</p>
            )}
          </div>

          {/* Quote */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-700">Quote</p>
            {quote ? (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                <div className="flex items-center gap-2">
                  <Link href={`/quotes/${quote.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
                    {quote.quote_number}
                  </Link>
                  <StatusBadge config={quoteStatusConfig[quote.status]} />
                </div>
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(quote.total)}</span>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">No quote linked.</p>
            )}
          </div>

          {/* Invoice */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-700">Invoice</p>
            {invoice ? (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                <div className="flex items-center gap-2">
                  <Link href={`/invoices/${invoice.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
                    {invoice.invoice_number}
                  </Link>
                  <StatusBadge config={invoiceStatusConfig[invoice.status]} />
                </div>
                {invoice.due_date ? (
                  <span className="text-xs text-slate-500">Due {formatDate(invoice.due_date)}</span>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">No invoice linked.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="flex-shrink-0 text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 1h3l1.5 3.5L5 6a8.5 8.5 0 0 0 3 3l1.5-1.5L13 9v3a1 1 0 0 1-1 1C5.373 13 1 8.627 1 3a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1C4.79 1 3 2.79 3 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4zm0 5.5A1.5 1.5 0 1 1 7 3a1.5 1.5 0 0 1 0 3z"
        fill="currentColor"
      />
    </svg>
  );
}
