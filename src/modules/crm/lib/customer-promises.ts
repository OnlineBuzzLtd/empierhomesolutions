import type { SupabaseClient } from "@supabase/supabase-js";
import type { Customer, CustomerPromise, UserProfile } from "@/modules/crm/types";
import { applyCrmModeFilter, crmDemoScenarioKey, type CrmMode } from "@/modules/crm/lib/demo";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { runCrmList, runCrmSingle } from "@/modules/crm/lib/data-runner";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import type { CustomerPromiseWithOwner } from "@/modules/crm/lib/customer-promise";
import { enqueueCrmPlatformEvent } from "@/modules/platform/lib/outbox";

type PromiseQueryable = {
  eq: (column: string, value: unknown) => PromiseQueryable;
  is: (column: string, value: null) => PromiseQueryable;
};

export type CustomerPromiseWithCustomer = CustomerPromiseWithOwner & {
  customer?: Pick<Customer, "id" | "full_name" | "postcode"> | null;
};

export type CustomerPromiseFilters = {
  customerId?: string | null;
  leadId?: string | null;
  jobId?: string | null;
  quoteId?: string | null;
  invoiceId?: string | null;
  status?: CustomerPromise["status"] | CustomerPromise["status"][];
  dueFrom?: string | null;
  dueTo?: string | null;
  limit?: number;
};

export type PromiseMutationInput = {
  tenant_id: string;
  customer_id?: string | null;
  lead_id?: string | null;
  job_id?: string | null;
  quote_id?: string | null;
  invoice_id?: string | null;
  platform_conversation_id?: string | null;
  platform_event_id?: string | null;
  promise_type?: CustomerPromise["promise_type"];
  title: string;
  detail?: string | null;
  owner_user_id?: string | null;
  due_at?: string | null;
  channel?: CustomerPromise["channel"];
  status?: CustomerPromise["status"];
  origin?: CustomerPromise["origin"];
  idempotency_key?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  is_demo?: boolean;
  demo_scenario_key?: string | null;
};

export async function listCustomerPromises(
  filters: CustomerPromiseFilters = {},
  mode?: CrmMode,
): Promise<CustomerPromiseWithOwner[]> {
  if (!getCrmEnv().enabled) {
    return [];
  }

  const context = await getPromiseModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase.schema("crm").from("customer_promises").select("*");
  applyPromiseModeFilter(query, context.mode, context.scenarioKey);
  applyPromiseFilters(query, filters);

  const rows = await runCrmList<CustomerPromise>(
    "listCustomerPromises",
    query.order("due_at", { ascending: true, nullsFirst: false }).order("updated_at", { ascending: false }).limit(filters.limit ?? 25),
  );
  return attachPromiseOwners(rows, mode);
}

export async function listCustomerPromisesForCalendar(input: {
  dueFrom: string;
  dueTo: string;
  mode?: CrmMode;
}) {
  if (!getCrmEnv().enabled) {
    return [] as CustomerPromiseWithCustomer[];
  }

  const context = await getPromiseModeContext(input.mode);
  const supabase = await createCrmServerClient();
  const query = supabase
    .schema("crm")
    .from("customer_promises")
    .select("*, customer:customers(id, full_name, postcode)")
    .eq("status", "open")
    .gte("due_at", input.dueFrom)
    .lte("due_at", input.dueTo);
  applyPromiseModeFilter(query, context.mode, context.scenarioKey);
  const rows = await runCrmList<CustomerPromiseWithCustomer>(
    "listCustomerPromisesForCalendar",
    query.order("due_at", { ascending: true }),
  );
  return attachPromiseOwners(rows, input.mode) as Promise<CustomerPromiseWithCustomer[]>;
}

export async function createCustomerPromiseWithClient(
  supabase: SupabaseClient,
  input: PromiseMutationInput,
) {
  if (input.idempotency_key) {
    const existing = await runCrmSingle<CustomerPromise>(
      "createCustomerPromiseWithClient.existing",
      supabase
        .schema("crm")
        .from("customer_promises")
        .select("*")
        .eq("tenant_id", input.tenant_id)
        .eq("idempotency_key", input.idempotency_key)
        .maybeSingle(),
    );
    if (existing) {
      return existing;
    }
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("customer_promises")
    .insert({
      ...input,
      promise_type: input.promise_type ?? "follow_up",
      channel: input.channel ?? "phone",
      status: input.status ?? "open",
      origin: input.origin ?? "office",
    })
    .select("*")
    .single<CustomerPromise>();

  if (error) {
    throw error;
  }

  await recordCustomerPromiseChange(supabase, null, data);
  return data;
}

export async function updateCustomerPromiseWithClient(
  supabase: SupabaseClient,
  tenantId: string,
  id: string,
  patch: Partial<PromiseMutationInput>,
) {
  const previous = await runCrmSingle<CustomerPromise>(
    "updateCustomerPromiseWithClient.previous",
    supabase
      .schema("crm")
      .from("customer_promises")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .single(),
  );

  const statusPatch =
    patch.status === "completed"
      ? { completed_at: new Date().toISOString() }
      : patch.status
        ? { completed_at: null }
        : {};

  const { data, error } = await supabase
    .schema("crm")
    .from("customer_promises")
    .update({
      ...patch,
      ...statusPatch,
    })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*")
    .single<CustomerPromise>();

  if (error) {
    throw error;
  }

  await recordCustomerPromiseChange(supabase, previous, data);
  return data;
}

async function recordCustomerPromiseChange(
  supabase: SupabaseClient,
  previous: CustomerPromise | null,
  next: CustomerPromise,
) {
  const eventType = classifyPromiseChange(previous, next);
  const changes = buildPromiseChanges(previous, next);
  const actorUserId = next.updated_by ?? next.created_by ?? null;

  const { error } = await supabase.schema("crm").from("customer_promise_events").insert({
    tenant_id: next.tenant_id,
    promise_id: next.id,
    event_type: eventType,
    actor_user_id: actorUserId,
    source: next.origin,
    previous_status: previous?.status ?? null,
    next_status: next.status,
    previous_due_at: previous?.due_at ?? null,
    next_due_at: next.due_at ?? null,
    changes,
  });

  if (error) {
    throw error;
  }

  await enqueueCrmPlatformEvent(supabase, {
    tenantId: next.tenant_id,
    eventType: "CustomerPromiseChanged",
    aggregateType: "customer_promise",
    aggregateId: next.id,
    idempotencyKey: `customer-promise:${next.id}:${eventType}:${next.updated_at}`,
    payload: {
      promise_id: next.id,
      customer_id: next.customer_id,
      lead_id: next.lead_id,
      job_id: next.job_id,
      quote_id: next.quote_id,
      invoice_id: next.invoice_id,
      platform_conversation_id: next.platform_conversation_id,
      promise_type: next.promise_type,
      title: next.title,
      detail: next.detail,
      owner_user_id: next.owner_user_id,
      due_at: next.due_at,
      channel: next.channel,
      status: next.status,
      origin: next.origin,
      event_type: eventType,
      changes,
    },
  });
}

function classifyPromiseChange(previous: CustomerPromise | null, next: CustomerPromise) {
  if (!previous) return "created";
  if (previous.status !== next.status) {
    if (next.status === "completed") return "completed";
    if (next.status === "cancelled") return "cancelled";
    if (next.status === "open") return "reopened";
  }
  return "updated";
}

function buildPromiseChanges(previous: CustomerPromise | null, next: CustomerPromise) {
  if (!previous) {
    return {
      created: true,
      status: next.status,
      due_at: next.due_at,
      owner_user_id: next.owner_user_id,
    };
  }

  const keys = [
    "customer_id",
    "lead_id",
    "job_id",
    "quote_id",
    "invoice_id",
    "platform_conversation_id",
    "promise_type",
    "title",
    "detail",
    "owner_user_id",
    "due_at",
    "channel",
    "status",
  ] as const;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    if (previous[key] !== next[key]) {
      changes[key] = { from: previous[key], to: next[key] };
    }
  }
  return changes;
}

async function getPromiseModeContext(mode?: CrmMode) {
  if (mode) {
    return { mode, scenarioKey: crmDemoScenarioKey };
  }
  const demoState = await getCrmDemoState();
  return {
    mode: demoState.mode,
    scenarioKey: demoState.scenarioKey ?? crmDemoScenarioKey,
  };
}

function applyPromiseModeFilter(query: PromiseQueryable, mode: CrmMode, scenarioKey = crmDemoScenarioKey) {
  applyCrmModeFilter(query, mode, scenarioKey);
  query.is("record_deleted_at", null);
}

function applyPromiseFilters(query: PromiseQueryable & {
  in?: (column: string, values: string[]) => unknown;
  gte?: (column: string, value: string) => unknown;
  lte?: (column: string, value: string) => unknown;
}, filters: CustomerPromiseFilters) {
  if (filters.customerId) query.eq("customer_id", filters.customerId);
  if (filters.leadId) query.eq("lead_id", filters.leadId);
  if (filters.jobId) query.eq("job_id", filters.jobId);
  if (filters.quoteId) query.eq("quote_id", filters.quoteId);
  if (filters.invoiceId) query.eq("invoice_id", filters.invoiceId);
  if (Array.isArray(filters.status)) {
    if (filters.status.length > 0) {
      query.in?.("status", filters.status);
    }
  } else if (filters.status) {
    query.eq("status", filters.status);
  }
  if (filters.dueFrom) query.gte?.("due_at", filters.dueFrom);
  if (filters.dueTo) query.lte?.("due_at", filters.dueTo);
}

async function attachPromiseOwners<T extends CustomerPromise>(
  rows: T[],
  mode?: CrmMode,
): Promise<Array<T & { owner?: Pick<UserProfile, "id" | "user_id" | "full_name" | "role"> | null }>> {
  const ownerIds = [...new Set(rows.map((row) => row.owner_user_id).filter((value): value is string => Boolean(value)))];
  if (ownerIds.length === 0) {
    return rows.map((row) => ({ ...row, owner: null }));
  }

  const context = await getPromiseModeContext(mode);
  const supabase = await createCrmServerClient();
  const usersQuery = supabase.schema("crm").from("user_profiles").select("id, user_id, full_name, role").in("user_id", ownerIds);
  applyCrmModeFilter(usersQuery, context.mode, context.scenarioKey);
  const users = await runCrmList<Pick<UserProfile, "id" | "user_id" | "full_name" | "role">>(
    "attachPromiseOwners",
    usersQuery,
  );
  const usersById = new Map(users.map((user) => [user.user_id, user]));
  return rows.map((row) => ({ ...row, owner: row.owner_user_id ? usersById.get(row.owner_user_id) ?? null : null }));
}
