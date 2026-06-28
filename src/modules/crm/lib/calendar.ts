import { addDays, addMonths, addWeeks, addYears, parseISO, startOfDay } from "date-fns";
import type { Appointment, CalendarItem, CustomerAsset, LeadStatus, UserProfile } from "@/modules/crm/types";
import type { CustomerPromiseWithCustomer } from "@/modules/crm/lib/customer-promises";

export function expandAppointmentOccurrences(appointment: Appointment, start: Date, end: Date) {
  const occurrences: Appointment[] = [];
  let currentStart = parseISO(appointment.starts_at);
  let currentEnd = parseISO(appointment.ends_at);

  while (currentStart <= end) {
    if (currentStart >= start) {
      occurrences.push({
        ...appointment,
        id: occurrences.length === 0 ? appointment.id : `${appointment.id}:${currentStart.toISOString()}`,
        starts_at: currentStart.toISOString(),
        ends_at: currentEnd.toISOString(),
      });
    }

    if (!appointment.recurrence_rule) {
      break;
    }

    const nextStart = advanceRecurringDate(currentStart, appointment.recurrence_rule);
    const nextEnd = advanceRecurringDate(currentEnd, appointment.recurrence_rule);
    if (!nextStart || !nextEnd) {
      break;
    }

    currentStart = nextStart;
    currentEnd = nextEnd;
  }

  return occurrences;
}

export function buildLeadFollowUpItem(lead: {
  id: string;
  status: LeadStatus;
  source: string | null;
  assigned_to: string | null;
  next_action_at: string;
  customer?: { id: string; full_name: string; postcode: string | null } | null;
}, usersById: Map<string, UserProfile>) {
  const owner = lead.assigned_to ? usersById.get(lead.assigned_to) ?? null : null;

  return {
    id: `lead-follow-up-${lead.id}`,
    customer_id: lead.customer?.id ?? null,
    lead_id: lead.id,
    job_id: null,
    assigned_to: lead.assigned_to ?? null,
    type: "follow_up",
    title: `Lead follow-up · ${lead.customer?.full_name ?? lead.source ?? "Lead"}`,
    starts_at: lead.next_action_at,
    ends_at: lead.next_action_at,
    status: "scheduled",
    reminder_offset_minutes: null,
    recurrence_rule: null,
    created_at: lead.next_action_at,
    source: "lead_follow_up",
    customer: lead.customer ?? null,
    lead: { id: lead.id, status: lead.status, source: lead.source },
    owner: owner ? { id: owner.id, full_name: owner.full_name, role: owner.role } : null,
    recurrence_origin_id: null,
    entity_link: "/leads",
    synthetic: true,
  } satisfies CalendarItem;
}

export function buildCustomerPromiseCalendarItem(
  promise: CustomerPromiseWithCustomer,
  usersById: Map<string, UserProfile>,
) {
  const owner = promise.owner_user_id ? (usersById.get(promise.owner_user_id) ?? promise.owner ?? null) : null;
  const customerName = promise.customer?.full_name ?? "Customer";
  const entityLink = derivePromiseEntityLink(promise);

  return {
    id: `customer-promise-${promise.id}`,
    customer_id: promise.customer_id,
    lead_id: promise.lead_id,
    job_id: promise.job_id,
    assigned_to: promise.owner_user_id,
    type: "follow_up",
    title: `${promise.title} · ${customerName}`,
    starts_at: promise.due_at ?? promise.updated_at,
    ends_at: promise.due_at ?? promise.updated_at,
    status: promise.status === "open" ? "scheduled" : promise.status,
    reminder_offset_minutes: null,
    recurrence_rule: null,
    created_at: promise.created_at,
    source: "customer_promise",
    customer: promise.customer ?? null,
    lead: promise.lead_id ? { id: promise.lead_id, status: "new", source: promise.origin } : null,
    owner: owner ? { id: owner.id, full_name: owner.full_name, role: owner.role } : null,
    recurrence_origin_id: promise.id,
    entity_link: entityLink,
    synthetic: true,
  } satisfies CalendarItem;
}

export function buildAssetReminderItems(asset: CustomerAsset & { customer?: CalendarItem["customer"] }, start: Date, end: Date) {
  const items: CalendarItem[] = [];
  const serviceDue = asset.service_due_date ? startOfDay(parseISO(asset.service_due_date)) : null;
  const warrantyEnd = asset.warranty_end_date ? startOfDay(parseISO(asset.warranty_end_date)) : null;

  if (serviceDue && serviceDue >= start && serviceDue <= end) {
    items.push({
      id: `asset-service-${asset.id}-${serviceDue.toISOString()}`,
      customer_id: asset.customer_id,
      lead_id: null,
      job_id: null,
      assigned_to: null,
      type: "reminder",
      title: `Service due · ${asset.customer?.full_name ?? asset.asset_type}`,
      starts_at: serviceDue.toISOString(),
      ends_at: serviceDue.toISOString(),
      status: "scheduled",
      reminder_offset_minutes: null,
      recurrence_rule: "yearly",
      created_at: serviceDue.toISOString(),
      source: "service_due",
      customer: asset.customer ?? null,
      lead: null,
      owner: null,
      recurrence_origin_id: asset.id,
      entity_link: asset.customer_id ? `/customers/${asset.customer_id}` : "/customers",
      synthetic: true,
    });
  }

  if (warrantyEnd && warrantyEnd >= start && warrantyEnd <= end) {
    items.push({
      id: `asset-warranty-${asset.id}-${warrantyEnd.toISOString()}`,
      customer_id: asset.customer_id,
      lead_id: null,
      job_id: null,
      assigned_to: null,
      type: "reminder",
      title: `Warranty expiry · ${asset.customer?.full_name ?? asset.asset_type}`,
      starts_at: warrantyEnd.toISOString(),
      ends_at: warrantyEnd.toISOString(),
      status: "scheduled",
      reminder_offset_minutes: null,
      recurrence_rule: null,
      created_at: warrantyEnd.toISOString(),
      source: "warranty_expiry",
      customer: asset.customer ?? null,
      lead: null,
      owner: null,
      recurrence_origin_id: asset.id,
      entity_link: asset.customer_id ? `/customers/${asset.customer_id}` : "/customers",
      synthetic: true,
    });
  }

  return items;
}

function derivePromiseEntityLink(promise: CustomerPromiseWithCustomer) {
  if (promise.lead_id) {
    return `/leads?tab=todo&highlight=${encodeURIComponent(promise.lead_id)}`;
  }
  if (promise.job_id) {
    return `/jobs/${promise.job_id}`;
  }
  if (promise.quote_id) {
    return `/quotes/${promise.quote_id}`;
  }
  if (promise.invoice_id) {
    return `/invoices/${promise.invoice_id}`;
  }
  if (promise.customer_id) {
    return `/customers/${promise.customer_id}`;
  }
  return "/inbox";
}

function advanceRecurringDate(date: Date, rule: string) {
  switch (rule) {
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addWeeks(date, 1);
    case "monthly":
      return addMonths(date, 1);
    case "yearly":
      return addYears(date, 1);
    default:
      return null;
  }
}
