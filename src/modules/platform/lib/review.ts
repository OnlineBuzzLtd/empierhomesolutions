import type { PlatformConversationRecord } from "@/modules/platform/lib/repository";

export type PlatformConversationReviewMeta = {
  status: "open" | "in_progress";
  assigneeUserId: string | null;
  assigneeName: string | null;
  assignedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type PlatformConversationReviewState = {
  needsReview: boolean;
  priority: "high" | "medium" | null;
  reasons: string[];
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function pickNullableString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getPlatformConversationReviewMeta(
  record: PlatformConversationRecord,
): PlatformConversationReviewMeta {
  const metadata = asRecord(record.link.metadata);

  return {
    status: pickNullableString(metadata, "review_status") === "in_progress" ? "in_progress" : "open",
    assigneeUserId: pickNullableString(metadata, "review_assignee_user_id"),
    assigneeName: pickNullableString(metadata, "review_assignee_name"),
    assignedAt: pickNullableString(metadata, "review_assigned_at"),
    updatedAt: pickNullableString(metadata, "review_updated_at"),
    updatedBy: pickNullableString(metadata, "review_updated_by"),
  };
}

export function getPlatformConversationReviewState(
  record: PlatformConversationRecord,
): PlatformConversationReviewState {
  const reasons: string[] = [];

  if (record.customer === null) {
    reasons.push("No CRM customer linked");
  }

  if (record.lead !== null && record.customer === null) {
    reasons.push("Lead exists without a customer link");
  }

  if (record.bookingAppointment !== null && record.job === null) {
    reasons.push("Booking exists without a CRM job");
  }

  if (record.link.latest_channel === "voice" && record.customer === null) {
    reasons.push("Voice recovery still unresolved");
  }

  const uniqueReasons = dedupe(reasons);
  if (uniqueReasons.length === 0) {
    return {
      needsReview: false,
      priority: null,
      reasons: [],
    };
  }

  const priority =
    uniqueReasons.includes("No CRM customer linked") ||
    uniqueReasons.includes("Lead exists without a customer link") ||
    uniqueReasons.includes("Voice recovery still unresolved")
      ? "high"
      : "medium";

  return {
    needsReview: true,
    priority,
    reasons: uniqueReasons,
  };
}

export function listReviewablePlatformConversationRecords(records: PlatformConversationRecord[]) {
  return records.filter((record) => getPlatformConversationReviewState(record).needsReview);
}
