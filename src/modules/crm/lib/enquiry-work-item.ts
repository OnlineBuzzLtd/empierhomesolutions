import type { LeadWithRelations } from "@/modules/crm/types";
import { formatDate, formatRelativeTime } from "@/modules/crm/lib/format";

function cleanJoin(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" · ");
}

function formatUrgency(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getEnquiryWorkItemSummary(lead: LeadWithRelations) {
  const contactLine = cleanJoin([lead.customer?.phone, lead.customer?.email]);
  const serviceLine = cleanJoin([lead.service?.name, lead.job_type?.name]);
  const urgency = formatUrgency(lead.urgency_level);
  const source = lead.source?.trim() || "No source";
  const ownerLabel = lead.owner?.full_name ?? (lead.assigned_to ? "Assigned" : "Unassigned");
  const dueLabel = lead.next_action_at ? `Next action ${formatRelativeTime(lead.next_action_at)}` : "No next action set";

  return {
    title: lead.customer?.full_name ?? "Unlinked enquiry",
    reason: lead.problem_description?.trim() || lead.notes?.trim() || "No problem captured yet.",
    contactLine: contactLine || "No phone or email",
    contextLine: cleanJoin([serviceLine || "Service TBC", urgency, source]),
    ownerLabel,
    receivedLabel: `Received ${formatDate(lead.created_at)}`,
    dueLabel,
    primaryActionLabel: lead.status === "new" || lead.status === "contacted" || lead.status === "follow_up" ? "Review" : "Open",
  };
}
