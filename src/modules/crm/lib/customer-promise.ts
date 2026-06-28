import type { CustomerPromise, LeadWithRelations, UserProfile } from "@/modules/crm/types";
import { formatDate, formatDateTime } from "@/modules/crm/lib/format";

export type CustomerPromiseState = "ready" | "overdue" | "unset";

export type CustomerPromiseSummary = {
  id?: string;
  source: "explicit" | "derived";
  state: CustomerPromiseState;
  title: string;
  detail: string;
  ownerLabel: string;
  ownerUserId?: string | null;
  dueLabel: string;
  dueAt?: string | null;
  channelLabel: string;
  channel?: CustomerPromise["channel"] | null;
  promiseType?: CustomerPromise["promise_type"] | null;
  status?: CustomerPromise["status"] | null;
  origin?: CustomerPromise["origin"] | null;
};

export type CustomerPromiseWithOwner = CustomerPromise & {
  owner?: Pick<UserProfile, "id" | "user_id" | "full_name" | "role"> | null;
};

export function buildLeadPromiseSummary(lead: LeadWithRelations, now = new Date()): CustomerPromiseSummary {
  const ownerLabel = lead.owner?.full_name ?? (lead.assigned_to ? "Assigned" : "Unassigned");
  const contactChannel = lead.customer?.phone ? "Phone" : lead.customer?.email ? "Email" : "Not set";

  if (!lead.next_action_at) {
    return {
      source: "derived",
      state: "unset",
      title: "No next promise set",
      detail: "Set a follow-up time before leaving this enquiry waiting.",
      ownerLabel,
      ownerUserId: lead.assigned_to,
      dueLabel: "No due time",
      dueAt: null,
      channelLabel: contactChannel,
      channel: lead.customer?.phone ? "phone" : lead.customer?.email ? "email" : null,
    };
  }

  const due = new Date(lead.next_action_at);
  const overdue = Number.isFinite(due.getTime()) && due.getTime() < now.getTime();

  return {
    source: "derived",
    state: overdue ? "overdue" : "ready",
    title: overdue ? "Promise overdue" : "Next customer promise",
    detail: overdue ? "This customer was due a follow-up." : "The next office action is scheduled.",
    ownerLabel,
    ownerUserId: lead.assigned_to,
    dueLabel: formatDateTime(lead.next_action_at),
    dueAt: lead.next_action_at,
    channelLabel: contactChannel,
    channel: lead.customer?.phone ? "phone" : lead.customer?.email ? "email" : null,
    promiseType: "follow_up",
    status: "open",
  };
}

export function buildRecordPromiseSummary(input: {
  dueAt: string | null | undefined;
  title: string;
  readyDetail: string;
  overdueTitle?: string;
  overdueDetail?: string;
  unsetTitle: string;
  unsetDetail: string;
  ownerLabel?: string | null;
  channelLabel?: string | null;
  dateOnly?: boolean;
  ignoreOverdue?: boolean;
}, now = new Date()): CustomerPromiseSummary {
  const ownerLabel = input.ownerLabel?.trim() || "Unassigned";
  const channelLabel = input.channelLabel?.trim() || "Not set";

  if (!input.dueAt) {
    return {
      source: "derived",
      state: "unset",
      title: input.unsetTitle,
      detail: input.unsetDetail,
      ownerLabel,
      dueLabel: "No due time",
      dueAt: null,
      channelLabel,
    };
  }

  const due = new Date(input.dueAt);
  const overdue = !input.ignoreOverdue && Number.isFinite(due.getTime()) && due.getTime() < now.getTime();

  return {
    source: "derived",
    state: overdue ? "overdue" : "ready",
    title: overdue ? (input.overdueTitle ?? "Promise overdue") : input.title,
    detail: overdue ? (input.overdueDetail ?? "This customer-facing action is overdue.") : input.readyDetail,
    ownerLabel,
    dueLabel: input.dateOnly ? formatDate(input.dueAt) : formatDateTime(input.dueAt),
    dueAt: input.dueAt,
    channelLabel,
  };
}

export function buildExplicitPromiseSummary(
  promise: CustomerPromiseWithOwner,
  now = new Date(),
): CustomerPromiseSummary {
  const due = promise.due_at ? new Date(promise.due_at) : null;
  const overdue =
    promise.status === "open" &&
    due !== null &&
    Number.isFinite(due.getTime()) &&
    due.getTime() < now.getTime();
  const completed = promise.status === "completed";

  return {
    id: promise.id,
    source: "explicit",
    state: completed ? "ready" : overdue ? "overdue" : promise.due_at ? "ready" : "unset",
    title: completed ? "Promise completed" : overdue ? "Promise overdue" : promise.title,
    detail:
      completed
        ? promise.detail ?? "This customer promise has been completed."
        : overdue
          ? promise.detail ?? "This customer was due a follow-up."
          : promise.detail ?? "The next customer action is scheduled.",
    ownerLabel: promise.owner?.full_name ?? (promise.owner_user_id ? "Assigned" : "Unassigned"),
    ownerUserId: promise.owner_user_id,
    dueLabel: promise.due_at ? formatDateTime(promise.due_at) : "No due time",
    dueAt: promise.due_at,
    channelLabel: formatPromiseChannel(promise.channel),
    channel: promise.channel,
    promiseType: promise.promise_type,
    status: promise.status,
    origin: promise.origin,
  };
}

export function pickPrimaryCustomerPromise(promises: CustomerPromiseWithOwner[]) {
  const open = promises.filter((promise) => promise.status === "open");
  if (open.length === 0) {
    return null;
  }
  return [...open].sort((left, right) => {
    const leftDue = left.due_at ? new Date(left.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.due_at ? new Date(right.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDue - rightDue || right.updated_at.localeCompare(left.updated_at);
  })[0] ?? null;
}

export function choosePromiseSummary(
  explicitPromises: CustomerPromiseWithOwner[],
  fallback: CustomerPromiseSummary,
  now = new Date(),
) {
  const primary = pickPrimaryCustomerPromise(explicitPromises);
  return primary ? buildExplicitPromiseSummary(primary, now) : fallback;
}

export function formatPromiseChannel(channel: CustomerPromise["channel"] | null | undefined) {
  switch (channel) {
    case "phone":
      return "Phone";
    case "email":
      return "Email";
    case "sms":
      return "SMS";
    case "whatsapp":
      return "WhatsApp";
    case "webchat":
      return "Web chat";
    case "voice":
      return "Voice";
    case "office":
      return "Office";
    case "other":
      return "Other";
    default:
      return "Not set";
  }
}

export function buildCustomerPromiseSummary(
  leads: LeadWithRelations[],
  fallback: {
    ownerLabel?: string | null;
    channelLabel?: string | null;
  } = {},
  now = new Date(),
): CustomerPromiseSummary {
  const openLeads = leads.filter((lead) => !["converted", "lost", "closed"].includes(lead.status));
  const datedLead = openLeads
    .filter((lead) => Boolean(lead.next_action_at))
    .sort((a, b) => new Date(a.next_action_at ?? 0).getTime() - new Date(b.next_action_at ?? 0).getTime())[0];

  if (datedLead) {
    return buildLeadPromiseSummary(datedLead, now);
  }

  if (openLeads[0]) {
    return buildLeadPromiseSummary(openLeads[0], now);
  }

  return {
    source: "derived",
    state: "unset",
    title: "No open customer promise",
    detail: "No active enquiry follow-up is waiting for this customer.",
    ownerLabel: fallback.ownerLabel?.trim() || "Unassigned",
    dueLabel: "No due time",
    dueAt: null,
    channelLabel: fallback.channelLabel?.trim() || "Not set",
  };
}
