import Link from "next/link";
import { CommsoftBottomNav } from "@/modules/crm/components/commusoft/CommsoftHome";
import { CommsoftJobActions } from "@/modules/crm/components/commusoft/CommsoftJobActions";
import { formatDate, formatDateTime, formatScheduledTime } from "@/modules/crm/lib/format";
import type {
  Attachment,
  EngineerAiAssistState,
  Expense,
  Invoice,
  JobChecklist,
  JobWithRelations,
  Note,
  Payment,
  Quote,
} from "@/modules/crm/types";

export function CommsoftJobEvent({
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
  const siteAddress = [job.site?.address_line1, job.site?.city, job.site?.postcode].filter(Boolean).join(", ");
  const customerAddress = [job.customer?.address_line1, job.customer?.postcode].filter(Boolean).join(", ");
  const displayAddress = siteAddress || customerAddress || "Address not set";
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`;
  // EHS-V-001 badge trigger: voice bookings can confirm without a
  // postcode (see appointment.postcode_status = "needs_verification").
  // Engineers should phone-confirm the address before dispatch.
  const postcodeNeedsVerification = !job.site?.postcode && !job.customer?.postcode;

  const mandatoryChecklists = (job.checklists ?? []).filter(
    (c) => c.is_mandatory && c.status !== "completed",
  );

  const isCompleted =
    job.status === "completed" ||
    job.status === "invoiced" ||
    job.status === "no_access" ||
    job.status === "aborted";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Page header */}
      <div className="flex items-center justify-between bg-[#4a7fa5] px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-white">
            <BackArrow />
          </Link>
          <h1 className="text-base font-semibold text-white">Job event</h1>
        </div>
        <Link href="/preferences" className="text-white opacity-80" title="Preferences">
          <GridIcon />
        </Link>
      </div>

      {/* Completed banner */}
      {isCompleted ? <CompletedBanner job={job} /> : null}

      {/* Action buttons — client component */}
      {!isCompleted ? (
        <CommsoftJobActions
          jobId={job.id}
          jobStatus={job.status}
          mandatoryChecklists={mandatoryChecklists}
        />
      ) : null}

      {/* Info cards */}
      <div className="flex-1 space-y-0 divide-y divide-slate-100 px-4 py-4">

        {/* Customer card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-3 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <InfoRow bold label="Name" value={job.customer?.full_name ?? "Not set"} />
              <InfoRow label="Address" value={displayAddress} />
              {postcodeNeedsVerification ? (
                <div className="mt-1 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                  <span aria-hidden className="text-base leading-none text-amber-600">⚠</span>
                  <div className="text-xs">
                    <p className="font-semibold text-amber-900">Postcode not captured</p>
                    <p className="text-amber-800">
                      Booking arrived without a postcode (typically voice — UK postcodes are unreliable over ASR).
                      Phone the customer to confirm the address before dispatch.
                    </p>
                  </div>
                </div>
              ) : null}
              {job.site?.access_notes ? (
                <div>
                  <span className="text-xs font-semibold text-amber-700">Access: </span>
                  <span className="text-sm text-slate-600">{job.site.access_notes}</span>
                </div>
              ) : null}
            </div>
            <div className="flex flex-shrink-0 gap-3 pl-4">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#4a7fa5]"
                title="Directions"
              >
                <DirectionsIcon />
              </a>
              {job.customer?.phone ? (
                <a
                  href={`tel:${job.customer.phone.replace(/\s+/g, "")}`}
                  className="text-[#4a7fa5]"
                  title="Call customer"
                >
                  <PhoneIcon />
                </a>
              ) : null}
              {job.customer?.email ? (
                <a
                  href={`mailto:${job.customer.email}`}
                  className="text-[#4a7fa5]"
                  title="Email customer"
                >
                  <EmailIcon />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* Diary event card */}
        {job.scheduled_date ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-3 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Diary event :</p>
            <p className="mt-1 text-sm text-slate-800">
              {formatDate(job.scheduled_date)}
              {job.scheduled_time ? ` (${formatScheduledTime(job.scheduled_date, job.scheduled_time)})` : ""}
            </p>
          </div>
        ) : null}

        {/* Job details card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-3 shadow-sm space-y-3">
          {job.description ? (
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Event description</p>
                <p className="mt-1 text-sm text-slate-800">{job.description}</p>
              </div>
              <EditIcon className="ml-3 mt-0.5 flex-shrink-0 text-[#4a7fa5]" />
            </div>
          ) : null}

          {job.site_contact ? (
            <div className="flex items-start justify-between border-t border-slate-100 pt-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">Job Contact</p>
                <p className="mt-1 text-sm text-slate-800">{job.site_contact.full_name}</p>
              </div>
              {job.site_contact.phone ? (
                <a href={`tel:${job.site_contact.phone.replace(/\s+/g, "")}`} className="text-[#4a7fa5]">
                  <PhoneIcon />
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">Job number</p>
              <p className="mt-1 text-sm font-medium text-blue-600">#{job.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Service info */}
        {job.service?.name ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-3 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Service</p>
            <p className="mt-1 text-sm text-slate-800">
              {job.service.name}
              {job.job_type?.name ? ` · ${job.job_type.name}` : ""}
            </p>
          </div>
        ) : null}

        {/* Started at */}
        {job.started_at ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-3 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Arrived on site</p>
            <p className="mt-1 text-sm text-slate-800">{formatDateTime(job.started_at)}</p>
          </div>
        ) : null}
      </div>

      <CommsoftBottomNav active="home" />
    </div>
  );
}

function CompletedBanner({ job }: { job: JobWithRelations }) {
  const statusMessages: Record<string, string> = {
    completed: "Job is completed, and you need to action it",
    invoiced: "Job is invoiced",
    no_access: "No access recorded",
    aborted: "Job was aborted",
  };

  const headerMessages: Record<string, string> = {
    completed: "Left site",
    invoiced: "Invoiced",
    no_access: "No access",
    aborted: "Aborted",
  };

  return (
    <div className="bg-emerald-500 px-4 py-3">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="white" aria-hidden>
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.5 5L7 11 4.5 8.5l1-1L7 9l3.5-4 1 1z" />
        </svg>
        <p className="text-sm font-semibold text-white">
          {headerMessages[job.status] ?? "Completed"}
        </p>
      </div>
      <p className="mt-0.5 text-xs text-emerald-100">
        {statusMessages[job.status] ?? "Job is complete"}
      </p>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm ${bold ? "font-semibold text-slate-900" : "text-slate-700"}`}>
        {value}
      </p>
    </div>
  );
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="3" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="12" y="3" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="3" y="12" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="12" y="12" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  );
}

function DirectionsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M11 3l8 8-8 8-8-8 8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 8v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M4 3h4.5l2 5-2.5 1.5a10 10 0 0 0 4.5 4.5L14 11.5l5 2V18a2 2 0 0 1-2 2A17 17 0 0 1 2 5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="2" y="5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 8l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={className} aria-hidden>
      <path
        d="M13 2.5l2.5 2.5L5 15.5H2.5V13L13 2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
