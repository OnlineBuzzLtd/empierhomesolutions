import type { CalendarItem, DashboardData } from "@/modules/crm/types";
import { formatCurrency } from "@/modules/crm/lib/format";

export type TodayAttentionItem = {
  id: "enquiries" | "follow-ups" | "ai-review" | "money" | "jobs" | "quotes";
  title: string;
  detail: string;
  value: string;
  href: string;
  action: string;
  priority: "high" | "medium" | "normal";
};

export function countDueFollowUpItems(
  calendarItems: Array<Pick<CalendarItem, "source" | "starts_at" | "status">>,
  now = new Date(),
) {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return calendarItems.filter((item) => {
    const isFollowUp = item.source === "lead_follow_up" || item.source === "customer_promise";
    if (!isFollowUp || item.status === "completed" || item.status === "cancelled") {
      return false;
    }
    const startsAt = new Date(item.starts_at);
    return Number.isFinite(startsAt.getTime()) && startsAt.getTime() <= endOfToday.getTime();
  }).length;
}

export function buildTodayAttentionItems(dashboard: Pick<DashboardData, "newLeadCount" | "followUpDueCount" | "aiReceptionistReviewCount" | "unpaidInvoicesTotal" | "todaysJobs">) {
  const items: TodayAttentionItem[] = [];

  if (dashboard.newLeadCount > 0) {
    items.push({
      id: "enquiries",
      title: "New enquiries",
      detail: "Customer requests waiting for office action.",
      value: String(dashboard.newLeadCount),
      href: "/leads?tab=todo",
      action: "Review",
      priority: "high",
    });
  }

  if (dashboard.followUpDueCount > 0) {
    items.push({
      id: "follow-ups",
      title: "Follow-ups due",
      detail: "Callbacks and customer promises due today or overdue.",
      value: String(dashboard.followUpDueCount),
      href: "/inbox",
      action: "Call",
      priority: "high",
    });
  }

  if (dashboard.aiReceptionistReviewCount > 0) {
    items.push({
      id: "ai-review",
      title: "AI handoffs",
      detail: "Conversations or bookings that need a person.",
      value: String(dashboard.aiReceptionistReviewCount),
      href: "/ai-hub?tab=needs-review",
      action: "Open",
      priority: "high",
    });
  }

  if (dashboard.unpaidInvoicesTotal > 0) {
    items.push({
      id: "money",
      title: "Money to collect",
      detail: "Unpaid invoices need chasing or allocation.",
      value: formatCurrency(dashboard.unpaidInvoicesTotal),
      href: "/invoices",
      action: "Chase",
      priority: "medium",
    });
  }

  if (dashboard.todaysJobs.length > 0) {
    items.push({
      id: "jobs",
      title: "Jobs today",
      detail: "Check the diary and unblock anything missing.",
      value: String(dashboard.todaysJobs.length),
      href: "/calendar",
      action: "Check",
      priority: "normal",
    });
  }

  items.push({
    id: "quotes",
    title: "Quotes",
    detail: "Send, chase, or update quotes waiting on customers.",
    value: "Open",
    href: "/quotes",
    action: "Review",
    priority: "normal",
  });

  return items;
}
