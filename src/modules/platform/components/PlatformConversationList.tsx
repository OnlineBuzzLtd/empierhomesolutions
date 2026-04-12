import type { ReactNode } from "react";
import Link from "next/link";
import { StatusBadge } from "@/modules/crm/components/shared/StatusBadge";
import { jobStatusConfig, leadStatusConfig } from "@/modules/crm/lib/status";
import { PlatformConversationRelinkForm } from "@/modules/platform/components/PlatformConversationRelinkForm";
import { PlatformConversationReviewActions } from "@/modules/platform/components/PlatformConversationReviewActions";
import type { PlatformConversationRecord } from "@/modules/platform/lib/repository";
import { formatPlatformTimestamp, humanizePlatformKey } from "@/modules/platform/lib/presenter";
import { getPlatformConversationReviewMeta, getPlatformConversationReviewState } from "@/modules/platform/lib/review";

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function appointmentBadgeClass(status: string) {
  switch (status) {
    case "scheduled":
      return "bg-blue-100 text-blue-700";
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function appointmentBadgeLabel(status: string) {
  return humanizePlatformKey(status);
}

function getConversationSummary(record: PlatformConversationRecord) {
  const metadata = asRecord(record.link.metadata);
  return (
    pickString(metadata, ["message_summary", "latest_reason", "booking_slot_label"]) ??
    record.bookingAppointment?.title ??
    record.callbackAppointment?.title ??
    "AI-originated workspace conversation."
  );
}

function getConversationFlags(record: PlatformConversationRecord) {
  const metadata = asRecord(record.link.metadata);
  const memoryApplied = asRecord(metadata.memory_applied);
  return {
    returningCustomer: metadata.returning_customer === true || memoryApplied.isReturningCustomer === true,
    restarted: typeof metadata.prior_session_id === "string" && metadata.prior_session_id.length > 0,
    restartReason: pickString(metadata, ["restart_reason"]),
    priorSessionId: pickString(metadata, ["prior_session_id"]),
    memoryHint:
      memoryApplied.suggestedAddress === true
        ? "Address memory used"
        : memoryApplied.suggestedService === true
          ? "Service memory used"
          : null,
  };
}

function getConversationIdentity(record: PlatformConversationRecord) {
  const values = [record.customer?.phone, record.link.identity_phone, record.customer?.email, record.link.identity_email].filter(
    (value): value is string => Boolean(value),
  );

  return [...new Set(values)];
}

function getConversationTimestamp(record: PlatformConversationRecord) {
  return (
    record.link.latest_event_at ??
    record.bookingAppointment?.starts_at ??
    record.callbackAppointment?.starts_at ??
    record.link.updated_at
  );
}

function EntityPanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function PlatformConversationList({
  records,
  emptyMessage,
  currentUser,
}: {
  records: PlatformConversationRecord[];
  emptyMessage: string;
  currentUser?: {
    id: string;
    name: string;
  };
}) {
  if (records.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {records.map((record) => {
        const summary = getConversationSummary(record);
        const identity = getConversationIdentity(record);
        const timestamp = getConversationTimestamp(record);
        const review = getPlatformConversationReviewState(record);
        const reviewMeta = getPlatformConversationReviewMeta(record);
        const flags = getConversationFlags(record);

        return (
          <article key={record.link.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {humanizePlatformKey(record.link.latest_channel ?? "conversation")} conversation
                  </p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    {record.link.conversation_id.slice(0, 8)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p>
                {review.needsReview ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        review.priority === "high" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {review.priority === "high" ? "Needs Review" : "Review Recommended"}
                    </span>
                    <p className="text-xs text-slate-500">{review.reasons.join(" · ")}</p>
                  </div>
                ) : null}
                {flags.returningCustomer || flags.restarted || flags.memoryHint ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {flags.returningCustomer ? (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
                        Returning customer
                      </span>
                    ) : null}
                    {flags.restarted ? (
                      <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-700">
                        Restarted session
                      </span>
                    ) : null}
                    {flags.memoryHint ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                        {flags.memoryHint}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {flags.restarted && (flags.restartReason || flags.priorSessionId) ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {[
                      flags.restartReason ? humanizePlatformKey(flags.restartReason) : null,
                      flags.priorSessionId ? `Prior session ${flags.priorSessionId.slice(0, 8)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {identity.length > 0 ? (
                  <p className="mt-2 text-xs text-slate-500">{identity.join(" · ")}</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Latest activity</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{formatPlatformTimestamp(timestamp)}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              <EntityPanel label="Customer">
                {record.customer ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{record.customer.full_name}</p>
                      <Link href={`/customers/${record.customer.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                        Open customer
                      </Link>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {[record.customer.phone, record.customer.email, record.customer.postcode].filter(Boolean).join(" · ") || "CRM customer linked"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No CRM customer linked yet.</p>
                )}
              </EntityPanel>

              <EntityPanel label="Lead">
                {record.lead ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">Lead {record.lead.id.slice(0, 8)}</p>
                      <StatusBadge config={leadStatusConfig[record.lead.status]} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {record.lead.source || "AI platform"} · Next action{" "}
                      {record.lead.next_action_at ? formatPlatformTimestamp(record.lead.next_action_at) : "not set"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No CRM lead linked yet.</p>
                )}
              </EntityPanel>

              <EntityPanel label="Job">
                {record.job ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{record.job.title}</p>
                      <StatusBadge config={jobStatusConfig[record.job.status]} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{record.job.scheduled_date || "Date TBC"}</span>
                      <Link href={`/jobs/${record.job.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                        Open job
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No CRM job linked yet.</p>
                )}
              </EntityPanel>

              <EntityPanel label="Callback">
                {record.callbackAppointment ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{record.callbackAppointment.title}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${appointmentBadgeClass(record.callbackAppointment.status)}`}>
                        {appointmentBadgeLabel(record.callbackAppointment.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {humanizePlatformKey(record.callbackAppointment.type)} · {formatPlatformTimestamp(record.callbackAppointment.starts_at)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No callback or follow-up appointment created.</p>
                )}
              </EntityPanel>

              <EntityPanel label="Booking">
                {record.bookingAppointment ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{record.bookingAppointment.title}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${appointmentBadgeClass(record.bookingAppointment.status)}`}>
                        {appointmentBadgeLabel(record.bookingAppointment.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {humanizePlatformKey(record.bookingAppointment.type)} · {formatPlatformTimestamp(record.bookingAppointment.starts_at)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No booked appointment created yet.</p>
                )}
              </EntityPanel>
            </div>

            <div className="mt-4">
              {review.needsReview && currentUser ? (
                <PlatformConversationReviewActions
                  conversationId={record.link.conversation_id}
                  currentStatus={reviewMeta.status}
                  assigneeUserId={reviewMeta.assigneeUserId}
                  assigneeName={reviewMeta.assigneeName}
                  currentUserId={currentUser.id}
                  currentUserName={currentUser.name}
                />
              ) : null}
              <PlatformConversationRelinkForm
                conversationId={record.link.conversation_id}
                customerId={record.link.customer_id}
                jobId={record.link.job_id}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
