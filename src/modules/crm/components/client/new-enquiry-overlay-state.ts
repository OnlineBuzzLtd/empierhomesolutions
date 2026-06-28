import type { LeadStatus } from "@/modules/crm/types";

export const newEnquiryOverlayTodoStatuses = ["new", "contacted", "follow_up"] as const satisfies readonly LeadStatus[];

export type RealtimeLeadInsert = {
  id: string;
  tenant_id: string;
  status: LeadStatus;
  source?: string | null;
  created_at?: string | null;
  problem_description?: string | null;
  notes?: string | null;
};

export function isNewEnquiryTodoStatus(status: unknown): status is (typeof newEnquiryOverlayTodoStatuses)[number] {
  return typeof status === "string" && newEnquiryOverlayTodoStatuses.some((todoStatus) => todoStatus === status);
}

export function toRealtimeLeadInsert(raw: unknown): RealtimeLeadInsert | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.tenant_id !== "string" || !isNewEnquiryTodoStatus(row.status)) {
    return null;
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    status: row.status,
    source: typeof row.source === "string" ? row.source : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    problem_description: typeof row.problem_description === "string" ? row.problem_description : null,
    notes: typeof row.notes === "string" ? row.notes : null,
  };
}

export function shouldShowNewEnquiryInsert(
  raw: unknown,
  context: {
    tenantId: string | null;
    dismissedIds: ReadonlySet<string>;
    queuedIds: ReadonlySet<string>;
  },
) {
  const lead = toRealtimeLeadInsert(raw);
  if (!lead || !context.tenantId) {
    return false;
  }
  if (lead.tenant_id !== context.tenantId) {
    return false;
  }
  if (context.dismissedIds.has(lead.id) || context.queuedIds.has(lead.id)) {
    return false;
  }
  return true;
}

export function queueNewEnquiry<T extends { id: string }>(current: T[], incoming: T, maxItems = 3) {
  const withoutExisting = current.filter((item) => item.id !== incoming.id);
  return [incoming, ...withoutExisting].slice(0, maxItems);
}

export function newEnquiryOverlayHref(id: string) {
  return `/leads?tab=todo&highlight=${encodeURIComponent(id)}`;
}
