import type { CalendarItem } from "@/modules/crm/types";
import type { PlatformConversationRecord } from "@/modules/platform/lib/repository";
import { getPlatformConversationReviewMeta, getPlatformConversationReviewState } from "@/modules/platform/lib/review";

const dayMs = 24 * 60 * 60 * 1000;

export type OfficeInboxQueueItem = {
  id: string;
  kind: "ai_review" | "lead_follow_up" | "customer_promise";
  title: string;
  detail: string;
  dueLabel: string;
  href: string;
  action: string;
  priority: "high" | "medium" | "normal";
  sortAt: string;
};

export type OfficeInboxSummary = {
  totalCount: number;
  aiReviewCount: number;
  leadFollowUpCount: number;
  overdueCount: number;
  firstAction: string;
};

export function getOfficeInboxFollowUpWindowStart(now = new Date()) {
  return new Date(now.getTime() - 14 * dayMs);
}

export function buildOfficeInboxQueue({
  calendarItems,
  reviewRecords,
  now = new Date(),
  limit = 12,
}: {
  calendarItems: CalendarItem[];
  reviewRecords: PlatformConversationRecord[];
  now?: Date;
  limit?: number;
}) {
  const items = [
    ...reviewRecords.map((record) => buildAiReviewQueueItem(record, now)),
    ...calendarItems.filter(isOpenCustomerFollowUp).map((item) => buildCustomerFollowUpQueueItem(item, now)),
  ].sort(compareQueueItems);

  const limitedItems = items.slice(0, limit);
  const leadFollowUpCount = items.filter((item) => item.kind === "lead_follow_up" || item.kind === "customer_promise").length;
  const aiReviewCount = items.filter((item) => item.kind === "ai_review").length;
  const overdueCount = items.filter((item) => item.dueLabel === "Overdue").length;

  return {
    items: limitedItems,
    summary: {
      totalCount: items.length,
      aiReviewCount,
      leadFollowUpCount,
      overdueCount,
      firstAction:
        overdueCount > 0
          ? "Clear overdue follow-ups first"
          : aiReviewCount > 0
            ? "Review AI handoffs first"
            : leadFollowUpCount > 0
              ? "Work the follow-up list"
              : "No urgent inbox work",
    } satisfies OfficeInboxSummary,
  };
}

function isOpenCustomerFollowUp(item: CalendarItem) {
  return (
    (item.source === "lead_follow_up" || item.source === "customer_promise") &&
    item.status !== "completed" &&
    item.status !== "cancelled"
  );
}

function buildAiReviewQueueItem(record: PlatformConversationRecord, now: Date): OfficeInboxQueueItem {
  const review = getPlatformConversationReviewState(record);
  const meta = getPlatformConversationReviewMeta(record);
  const title =
    record.customer?.full_name ??
    record.link.identity_phone ??
    record.link.identity_email ??
    `${formatChannel(record.link.latest_channel)} conversation`;
  const detail =
    review.reasons.join(" · ") ||
    record.bookingAppointment?.title ||
    record.callbackAppointment?.title ||
    "Conversation needs office review.";
  const timestamp =
    record.link.latest_event_at ??
    record.bookingAppointment?.starts_at ??
    record.callbackAppointment?.starts_at ??
    record.link.updated_at;

  return {
    id: `ai-review:${record.link.id}`,
    kind: "ai_review",
    title,
    detail: meta.status === "in_progress" && meta.assigneeName ? `${detail} Assigned to ${meta.assigneeName}.` : detail,
    dueLabel: formatDueLabel(timestamp, now),
    href: "/ai-hub?tab=needs-review",
    action: "Review",
    priority: review.priority === "high" ? "high" : "medium",
    sortAt: timestamp,
  };
}

function buildCustomerFollowUpQueueItem(item: CalendarItem, now: Date): OfficeInboxQueueItem {
  const customerName = item.customer?.full_name ?? "Customer";
  const owner = item.owner?.full_name ? `Owner: ${item.owner.full_name}` : "Unassigned";
  const postcode = item.customer?.postcode ? ` · ${item.customer.postcode}` : "";
  const isSavedPromise = item.source === "customer_promise";
  const href =
    !isSavedPromise && item.lead?.id
      ? `/leads?tab=todo&highlight=${encodeURIComponent(item.lead.id)}`
      : item.entity_link ?? "/leads?tab=todo";

  return {
    id: `${isSavedPromise ? "customer-promise" : "lead-follow-up"}:${item.id}`,
    kind: isSavedPromise ? "customer_promise" : "lead_follow_up",
    title: customerName,
    detail: `${item.title.replace(/^Lead follow-up ·\s*/i, "")}${postcode} · ${owner}`,
    dueLabel: formatDueLabel(item.starts_at, now),
    href,
    action: item.lead?.id ? "Call" : "Open",
    priority: isOverdue(item.starts_at, now) ? "high" : "normal",
    sortAt: item.starts_at,
  };
}

function compareQueueItems(left: OfficeInboxQueueItem, right: OfficeInboxQueueItem) {
  const priorityOrder = { high: 0, medium: 1, normal: 2 } as const;
  const priorityDelta = priorityOrder[left.priority] - priorityOrder[right.priority];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return left.sortAt.localeCompare(right.sortAt);
}

function formatDueLabel(value: string, now: Date) {
  const due = new Date(value);
  if (!Number.isFinite(due.getTime())) {
    return "Due";
  }

  const diff = due.getTime() - now.getTime();
  if (diff < -60 * 1000) {
    return "Overdue";
  }
  if (Math.abs(diff) <= 60 * 1000) {
    return "Due now";
  }
  if (diff < dayMs) {
    return "Today";
  }
  if (diff < 2 * dayMs) {
    return "Tomorrow";
  }

  return `Due ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(due)}`;
}

function isOverdue(value: string, now: Date) {
  const due = new Date(value);
  return Number.isFinite(due.getTime()) && due.getTime() < now.getTime() - 60 * 1000;
}

function formatChannel(value: string | null) {
  switch (value) {
    case "voice":
      return "Phone";
    case "sms":
      return "SMS";
    case "whatsapp":
      return "WhatsApp";
    case "webchat":
      return "Web chat";
    default:
      return "Customer";
  }
}
