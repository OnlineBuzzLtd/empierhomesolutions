import type { SupabaseClient } from "@supabase/supabase-js";
import type { Appointment, Customer, Job, Lead } from "@/modules/crm/types";
import {
  platformCommandDeliveryStatusSchema,
  platformCommandEnvelopeSchema,
  platformEventEnvelopeSchema,
  platformEventProcessingStatusSchema,
  type PlatformCommandDeliveryStatus,
  type PlatformCommandEnvelope,
  type PlatformEventEnvelope,
  type PlatformEventProcessingStatus,
} from "@/modules/platform/contracts";

type WorkspaceAliasRow = {
  workspace_id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
};

type CustomerJourneysRuntimeLinkLookupRow = {
  crm_tenant_id: string;
  customerjourneys_tenant_id: string;
};

type PlatformEventRow = {
  event_id: string;
  workspace_id: string;
  tenant_id: string;
  event_type: PlatformEventEnvelope["event_type"];
  event_version: number;
  source_system: PlatformEventEnvelope["source_system"];
  idempotency_key: string;
  correlation_id: string | null;
  causation_id: string | null;
  aggregate_type: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  processing_status: PlatformEventProcessingStatus;
  occurred_at: string;
  received_at: string;
  processed_at: string | null;
  last_error: string | null;
};

type PlatformCommandRow = {
  command_id: string;
  workspace_id: string;
  tenant_id: string;
  command_type: PlatformCommandEnvelope["command_type"];
  command_version: number;
  source_system: PlatformCommandEnvelope["source_system"];
  target_system: PlatformCommandEnvelope["target_system"];
  idempotency_key: string;
  correlation_id: string | null;
  causation_id: string | null;
  aggregate_type: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  delivery_status: PlatformCommandDeliveryStatus;
  requested_by_user_id: string | null;
  issued_at: string;
  sent_at: string | null;
  acknowledged_at: string | null;
  last_error: string | null;
  attempt_count: number;
};

type PlatformConversationLinkRow = {
  id: string;
  workspace_id: string;
  tenant_id: string;
  conversation_id: string;
  customer_id: string | null;
  lead_id: string | null;
  job_id: string | null;
  callback_appointment_id: string | null;
  booking_appointment_id: string | null;
  latest_channel: string | null;
  identity_phone: string | null;
  identity_email: string | null;
  metadata: Record<string, unknown>;
  latest_event_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlatformOutboxEventRow = {
  id: string;
  workspace_id: string;
  tenant_id: string;
  event_type: PlatformEventEnvelope["event_type"];
  event_version: number;
  source_system: PlatformEventEnvelope["source_system"];
  idempotency_key: string;
  correlation_id: string | null;
  causation_id: string | null;
  aggregate_type: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  publication_status: "pending" | "published" | "failed";
  occurred_at: string;
  published_at: string | null;
  delivery_attempt_count: number;
  last_error: string | null;
};

export type WorkspaceAlias = WorkspaceAliasRow;

export type PlatformConversationLink = PlatformConversationLinkRow;

export type PlatformConversationCustomer = Pick<Customer, "id" | "full_name" | "phone" | "email" | "postcode">;
export type PlatformConversationLead = Pick<Lead, "id" | "status" | "source" | "next_action_at" | "updated_at">;
export type PlatformConversationJob = Pick<Job, "id" | "title" | "status" | "scheduled_date">;
export type PlatformConversationAppointment = Pick<Appointment, "id" | "type" | "title" | "starts_at" | "ends_at" | "status">;

export type PlatformConversationRecord = {
  link: PlatformConversationLink;
  customer: PlatformConversationCustomer | null;
  lead: PlatformConversationLead | null;
  job: PlatformConversationJob | null;
  callbackAppointment: PlatformConversationAppointment | null;
  bookingAppointment: PlatformConversationAppointment | null;
};

export type PlatformOutboxEventRecord = {
  id: string;
  tenant_id: string;
  publication_status: PlatformOutboxEventRow["publication_status"];
  occurred_at: string;
  published_at: string | null;
  delivery_attempt_count: number;
  last_error: string | null;
  envelope: PlatformEventEnvelope;
};

export type PlatformEventRecord = {
  tenant_id: string;
  processing_status: PlatformEventProcessingStatus;
  received_at: string;
  processed_at: string | null;
  last_error: string | null;
  envelope: PlatformEventEnvelope;
};

export type PlatformCommandRecord = {
  tenant_id: string;
  delivery_status: PlatformCommandDeliveryStatus;
  requested_by_user_id: string | null;
  sent_at: string | null;
  acknowledged_at: string | null;
  last_error: string | null;
  attempt_count: number;
  envelope: PlatformCommandEnvelope;
};

export type UpdatePlatformCommandStatusInput = {
  commandId: string;
  tenantId: string;
  status: PlatformCommandDeliveryStatus;
  lastError?: string | null;
};

function mapById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function mapPlatformEventRow(row: PlatformEventRow): PlatformEventRecord {
  return {
    tenant_id: row.tenant_id,
    processing_status: platformEventProcessingStatusSchema.parse(row.processing_status),
    received_at: row.received_at,
    processed_at: row.processed_at,
    last_error: row.last_error,
    envelope: platformEventEnvelopeSchema.parse({
      event_id: row.event_id,
      event_type: row.event_type,
      event_version: row.event_version,
      workspace_id: row.workspace_id,
      occurred_at: row.occurred_at,
      source_system: row.source_system,
      idempotency_key: row.idempotency_key,
      correlation_id: row.correlation_id,
      causation_id: row.causation_id,
      aggregate: {
        type: row.aggregate_type,
        id: row.aggregate_id,
      },
      payload: row.payload ?? {},
    }),
  };
}

function mapPlatformCommandRow(row: PlatformCommandRow): PlatformCommandRecord {
  return {
    tenant_id: row.tenant_id,
    delivery_status: platformCommandDeliveryStatusSchema.parse(row.delivery_status),
    requested_by_user_id: row.requested_by_user_id,
    sent_at: row.sent_at,
    acknowledged_at: row.acknowledged_at,
    last_error: row.last_error,
    attempt_count: row.attempt_count,
    envelope: platformCommandEnvelopeSchema.parse({
      command_id: row.command_id,
      command_type: row.command_type,
      command_version: row.command_version,
      workspace_id: row.workspace_id,
      issued_at: row.issued_at,
      source_system: row.source_system,
      target_system: row.target_system,
      idempotency_key: row.idempotency_key,
      correlation_id: row.correlation_id,
      causation_id: row.causation_id,
      aggregate: {
        type: row.aggregate_type,
        id: row.aggregate_id,
      },
      payload: row.payload ?? {},
    }),
  };
}

function mapPlatformOutboxEventRow(row: PlatformOutboxEventRow): PlatformOutboxEventRecord {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    publication_status: row.publication_status,
    occurred_at: row.occurred_at,
    published_at: row.published_at,
    delivery_attempt_count: row.delivery_attempt_count,
    last_error: row.last_error,
    envelope: platformEventEnvelopeSchema.parse({
      event_id: row.id,
      event_type: row.event_type,
      event_version: row.event_version,
      workspace_id: row.workspace_id,
      occurred_at: row.occurred_at,
      source_system: row.source_system,
      idempotency_key: row.idempotency_key,
      correlation_id: row.correlation_id,
      causation_id: row.causation_id,
      aggregate: {
        type: row.aggregate_type,
        id: row.aggregate_id,
      },
      payload: row.payload ?? {},
    }),
  };
}

export async function getWorkspaceAlias(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("workspace_aliases")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle<WorkspaceAliasRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getWorkspaceAliasByWorkspaceId(supabase: SupabaseClient, workspaceId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("workspace_aliases")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle<WorkspaceAliasRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function resolveWorkspaceAliasForIncomingWorkspaceId(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const directAlias = await getWorkspaceAliasByWorkspaceId(supabase, workspaceId);
  if (directAlias) {
    return directAlias;
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("customerjourneys_runtime_links")
    .select("crm_tenant_id, customerjourneys_tenant_id")
    .eq("customerjourneys_tenant_id", workspaceId)
    .maybeSingle<CustomerJourneysRuntimeLinkLookupRow>();

  if (error) {
    throw error;
  }

  if (!data?.crm_tenant_id) {
    return null;
  }

  // Resolve the real CRM workspace alias so that workspace_id is a valid FK
  // in platform_event_log / platform_command_log. Using the CJ tenant ID
  // directly as workspace_id would violate the FK constraint on those tables
  // because it is not present in crm.workspace_aliases.
  return getWorkspaceAlias(supabase, data.crm_tenant_id);
}

export async function listPlatformEvents(supabase: SupabaseClient, tenantId: string, limit = 25) {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_event_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as PlatformEventRow[]).map(mapPlatformEventRow);
}

export async function listPlatformCommands(supabase: SupabaseClient, tenantId: string, limit = 25) {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_command_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("issued_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as PlatformCommandRow[]).map(mapPlatformCommandRow);
}

export async function getPlatformCommandByIdempotencyKey(
  supabase: SupabaseClient,
  tenantId: string,
  targetSystem: PlatformCommandEnvelope["target_system"],
  idempotencyKey: string,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_command_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("target_system", targetSystem)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<PlatformCommandRow>();

  if (error) {
    throw error;
  }

  return data ? mapPlatformCommandRow(data) : null;
}

export async function recordPlatformEvent(supabase: SupabaseClient, alias: WorkspaceAlias, envelope: PlatformEventEnvelope) {
  const { error } = await supabase.schema("crm").from("platform_event_log").insert({
    event_id: envelope.event_id,
    workspace_id: alias.workspace_id,
    tenant_id: alias.tenant_id,
    event_type: envelope.event_type,
    event_version: envelope.event_version,
    source_system: envelope.source_system,
    idempotency_key: envelope.idempotency_key,
    correlation_id: envelope.correlation_id ?? null,
    causation_id: envelope.causation_id ?? null,
    aggregate_type: envelope.aggregate.type,
    aggregate_id: envelope.aggregate.id ?? null,
    payload: envelope.payload,
    occurred_at: envelope.occurred_at,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export async function updatePlatformEventStatus(
  supabase: SupabaseClient,
  eventId: string,
  tenantId: string,
  status: PlatformEventProcessingStatus,
  lastError?: string | null,
) {
  const patch: Record<string, unknown> = {
    processing_status: status,
    last_error: lastError ?? null,
  };

  if (status === "processed") {
    patch.processed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .schema("crm")
    .from("platform_event_log")
    .update(patch)
    .eq("event_id", eventId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }
}

export async function enqueuePlatformCommand(supabase: SupabaseClient, alias: WorkspaceAlias, envelope: PlatformCommandEnvelope) {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_command_log")
    .insert({
    command_id: envelope.command_id,
    workspace_id: alias.workspace_id,
    tenant_id: alias.tenant_id,
    command_type: envelope.command_type,
    command_version: envelope.command_version,
    source_system: envelope.source_system,
    target_system: envelope.target_system,
    idempotency_key: envelope.idempotency_key,
    correlation_id: envelope.correlation_id ?? null,
    causation_id: envelope.causation_id ?? null,
    aggregate_type: envelope.aggregate.type,
    aggregate_id: envelope.aggregate.id ?? null,
    payload: envelope.payload,
    issued_at: envelope.issued_at,
  })
    .select("*")
    .maybeSingle<PlatformCommandRow>();

  if (!error && data) {
    return mapPlatformCommandRow(data);
  }

  if (error && error.code !== "23505") {
    throw error;
  }

  const existing = await getPlatformCommandByIdempotencyKey(supabase, alias.tenant_id, envelope.target_system, envelope.idempotency_key);
  if (!existing) {
    throw new Error("Platform command was not inserted and no existing record was found.");
  }

  return existing;
}

export async function updatePlatformCommandStatus(
  supabase: SupabaseClient,
  input: UpdatePlatformCommandStatusInput,
) {
  const patch: Record<string, unknown> = {
    delivery_status: input.status,
    last_error: input.lastError ?? null,
  };

  if (input.status === "acked") {
    patch.acknowledged_at = new Date().toISOString();
  }

  if (input.status === "sent") {
    patch.sent_at = new Date().toISOString();
  }

  const { error } = await supabase
    .schema("crm")
    .from("platform_command_log")
    .update(patch)
    .eq("command_id", input.commandId)
    .eq("tenant_id", input.tenantId);

  if (error) {
    throw error;
  }
}

export async function enqueuePlatformOutboxEvent(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  envelope: PlatformEventEnvelope,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_outbox_events")
    .insert({
      id: envelope.event_id,
      workspace_id: alias.workspace_id,
      tenant_id: alias.tenant_id,
      event_type: envelope.event_type,
      event_version: envelope.event_version,
      source_system: envelope.source_system,
      idempotency_key: envelope.idempotency_key,
      correlation_id: envelope.correlation_id ?? null,
      causation_id: envelope.causation_id ?? null,
      aggregate_type: envelope.aggregate.type,
      aggregate_id: envelope.aggregate.id ?? null,
      payload: envelope.payload,
      occurred_at: envelope.occurred_at,
    })
    .select("*")
    .maybeSingle<PlatformOutboxEventRow>();

  if (!error && data) {
    return mapPlatformOutboxEventRow(data);
  }

  if (error && error.code !== "23505") {
    throw error;
  }

  const existing = await getPlatformOutboxEventByIdempotencyKey(supabase, alias.tenant_id, envelope.source_system, envelope.idempotency_key);
  if (!existing) {
    throw new Error("Platform outbox event was not inserted and no existing record was found.");
  }

  return existing;
}

export async function getPlatformOutboxEventByIdempotencyKey(
  supabase: SupabaseClient,
  tenantId: string,
  sourceSystem: PlatformEventEnvelope["source_system"],
  idempotencyKey: string,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_outbox_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("source_system", sourceSystem)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<PlatformOutboxEventRow>();

  if (error) {
    throw error;
  }

  return data ? mapPlatformOutboxEventRow(data) : null;
}

export async function listReadyPlatformOutboxEvents(supabase: SupabaseClient, limit = 25) {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_outbox_events")
    .select("*")
    .in("publication_status", ["pending", "failed"])
    .order("occurred_at", { ascending: true })
    .limit(limit)
    .returns<PlatformOutboxEventRow[]>();

  if (error) {
    throw error;
  }

  return ((data ?? []) as PlatformOutboxEventRow[]).map(mapPlatformOutboxEventRow);
}

export async function markPlatformOutboxEventPublished(
  supabase: SupabaseClient,
  input: {
    id: string;
    tenantId: string;
    publishedAt: string;
    deliveryAttemptCount: number;
  },
) {
  const { error } = await supabase
    .schema("crm")
    .from("platform_outbox_events")
    .update({
      publication_status: "published",
      published_at: input.publishedAt,
      last_error: null,
      delivery_attempt_count: input.deliveryAttemptCount,
    })
    .eq("id", input.id)
    .eq("tenant_id", input.tenantId);

  if (error) {
    throw error;
  }
}

export async function markPlatformOutboxEventFailed(
  supabase: SupabaseClient,
  input: {
    id: string;
    tenantId: string;
    errorMessage: string;
    deliveryAttemptCount: number;
  },
) {
  const { error } = await supabase
    .schema("crm")
    .from("platform_outbox_events")
    .update({
      publication_status: "failed",
      last_error: input.errorMessage,
      delivery_attempt_count: input.deliveryAttemptCount,
    })
    .eq("id", input.id)
    .eq("tenant_id", input.tenantId);

  if (error) {
    throw error;
  }
}

export async function getPlatformConversationLink(
  supabase: SupabaseClient,
  tenantId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_conversation_links")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .maybeSingle<PlatformConversationLinkRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function listPlatformConversationRecords(supabase: SupabaseClient, tenantId: string, limit = 20) {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_conversation_links")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("latest_event_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit)
    .returns<PlatformConversationLinkRow[]>();

  if (error) {
    throw error;
  }

  const links = (data ?? []) as PlatformConversationLinkRow[];
  if (links.length === 0) {
    return [] as PlatformConversationRecord[];
  }

  const customerIds = [...new Set(links.map((link) => link.customer_id).filter((value): value is string => Boolean(value)))];
  const leadIds = [...new Set(links.map((link) => link.lead_id).filter((value): value is string => Boolean(value)))];
  const jobIds = [...new Set(links.map((link) => link.job_id).filter((value): value is string => Boolean(value)))];
  const appointmentIds = [
    ...new Set(
      links
        .flatMap((link) => [link.callback_appointment_id, link.booking_appointment_id])
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const [customersResult, leadsResult, jobsResult, appointmentsResult] = await Promise.all([
    customerIds.length === 0
      ? Promise.resolve({ data: [] as PlatformConversationCustomer[], error: null })
      : supabase
          .schema("crm")
          .from("customers")
          .select("id, full_name, phone, email, postcode")
          .eq("tenant_id", tenantId)
          .in("id", customerIds)
          .returns<PlatformConversationCustomer[]>(),
    leadIds.length === 0
      ? Promise.resolve({ data: [] as PlatformConversationLead[], error: null })
      : supabase
          .schema("crm")
          .from("leads")
          .select("id, status, source, next_action_at, updated_at")
          .eq("tenant_id", tenantId)
          .in("id", leadIds)
          .returns<PlatformConversationLead[]>(),
    jobIds.length === 0
      ? Promise.resolve({ data: [] as PlatformConversationJob[], error: null })
      : supabase
          .schema("crm")
          .from("jobs")
          .select("id, title, status, scheduled_date")
          .eq("tenant_id", tenantId)
          .in("id", jobIds)
          .returns<PlatformConversationJob[]>(),
    appointmentIds.length === 0
      ? Promise.resolve({ data: [] as PlatformConversationAppointment[], error: null })
      : supabase
          .schema("crm")
          .from("appointments")
          .select("id, type, title, starts_at, ends_at, status")
          .eq("tenant_id", tenantId)
          .in("id", appointmentIds)
          .returns<PlatformConversationAppointment[]>(),
  ]);

  if (customersResult.error) {
    throw customersResult.error;
  }
  if (leadsResult.error) {
    throw leadsResult.error;
  }
  if (jobsResult.error) {
    throw jobsResult.error;
  }
  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  const customersById = mapById(customersResult.data ?? []);
  const leadsById = mapById(leadsResult.data ?? []);
  const jobsById = mapById(jobsResult.data ?? []);
  const appointmentsById = mapById(appointmentsResult.data ?? []);

  return links.map((link) => ({
    link,
    customer: link.customer_id ? customersById.get(link.customer_id) ?? null : null,
    lead: link.lead_id ? leadsById.get(link.lead_id) ?? null : null,
    job: link.job_id ? jobsById.get(link.job_id) ?? null : null,
    callbackAppointment: link.callback_appointment_id ? appointmentsById.get(link.callback_appointment_id) ?? null : null,
    bookingAppointment: link.booking_appointment_id ? appointmentsById.get(link.booking_appointment_id) ?? null : null,
  }));
}

export async function upsertPlatformConversationLink(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  input: {
    conversationId: string;
    customerId?: string | null;
    leadId?: string | null;
    jobId?: string | null;
    callbackAppointmentId?: string | null;
    bookingAppointmentId?: string | null;
    latestChannel?: string | null;
    identityPhone?: string | null;
    identityEmail?: string | null;
    metadata?: Record<string, unknown>;
    latestEventAt?: string | null;
  },
) {
  const existing = await getPlatformConversationLink(supabase, alias.tenant_id, input.conversationId);
  const payload = {
    workspace_id: alias.workspace_id,
    tenant_id: alias.tenant_id,
    conversation_id: input.conversationId,
    customer_id: input.customerId ?? existing?.customer_id ?? null,
    lead_id: input.leadId ?? existing?.lead_id ?? null,
    job_id: input.jobId ?? existing?.job_id ?? null,
    callback_appointment_id: input.callbackAppointmentId ?? existing?.callback_appointment_id ?? null,
    booking_appointment_id: input.bookingAppointmentId ?? existing?.booking_appointment_id ?? null,
    latest_channel: input.latestChannel ?? existing?.latest_channel ?? null,
    identity_phone: input.identityPhone ?? existing?.identity_phone ?? null,
    identity_email: input.identityEmail ?? existing?.identity_email ?? null,
    latest_event_at: input.latestEventAt ?? existing?.latest_event_at ?? null,
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };

  const { data, error } = await supabase
    .schema("crm")
    .from("platform_conversation_links")
    .upsert(payload, { onConflict: "tenant_id,conversation_id" })
    .select("*")
    .single<PlatformConversationLinkRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getPlatformWorkspaceOverview(supabase: SupabaseClient, tenantId: string) {
  const [alias, events, commands] = await Promise.all([
    getWorkspaceAlias(supabase, tenantId),
    listPlatformEvents(supabase, tenantId, 20),
    listPlatformCommands(supabase, tenantId, 20),
  ]);

  return {
    alias,
    events,
    commands,
    stats: {
      eventCount: events.length,
      commandCount: commands.length,
      openFailures: events.filter((event) => event.processing_status === "failed").length + commands.filter((command) => command.delivery_status === "failed").length,
      pendingCommands: commands.filter((command) => command.delivery_status === "pending").length,
      missedCalls: events.filter((event) => event.envelope.event_type === "MissedCallCaptured").length,
    },
  };
}
