import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AiAgentAction, AiConversation, AiConversationChannel, AiCrmImpact, AiMessage } from "@/modules/crm/types";
import type { LiveAgentInput, LiveAgentResult, LiveTesterStatus } from "@/modules/crm/lib/ai-hub-live-agent";
import { liveTesterStatuses } from "@/modules/crm/lib/ai-hub-live-agent";
import { getCrmEnv } from "@/modules/crm/lib/env";
import type {
  PlatformConversationAppointment,
  PlatformConversationCustomer,
  PlatformConversationJob,
  PlatformConversationLead,
  PlatformConversationRecord,
  WorkspaceAlias,
} from "@/modules/platform/lib/repository";
import { getPlatformConversationLink, getWorkspaceAlias } from "@/modules/platform/lib/repository";

export const liveFrontDeskTesterTenantId = "11111111-1111-4111-8111-111111111111";

const liveConversationChannelSchema = z.enum(["sms", "whatsapp", "web_chat"]);
export type LiveConversationChannel = z.infer<typeof liveConversationChannelSchema>;

export const liveFrontDeskSessionCreateSchema = z
  .object({
    channel: liveConversationChannelSchema,
    customer_name: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.union([z.literal(""), z.string().email()]).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.channel === "sms" || value.channel === "whatsapp") && !value.phone?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Phone is required for SMS and WhatsApp sessions.",
        path: ["phone"],
      });
    }
  });

export const liveFrontDeskMessageCreateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

type AiConversationRow = {
  id: string;
  scenario_key: string;
  title: string;
  subtitle: string | null;
  channel: AiConversationChannel;
  customer_name: string;
  customer_handle: string;
  inbound_label: string;
  summary: string;
  final_outcome: string;
  roi_metrics: Record<string, unknown>;
  extracted_entities: Record<string, unknown>;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
  updated_at?: string | null;
};

export type LiveFrontDeskSessionListItem = {
  id: string;
  title: string;
  channel: LiveConversationChannel;
  customerName: string;
  status: LiveTesterStatus;
  updatedAt: string;
};

export type LiveFrontDeskSession = {
  conversation: AiConversation;
  status: LiveTesterStatus;
  latestError: string | null;
  platformRecord: PlatformConversationRecord | null;
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeLiveStatus(value: unknown): LiveTesterStatus {
  return liveTesterStatuses.includes(value as LiveTesterStatus) ? (value as LiveTesterStatus) : "open";
}

function zeroRoiMetrics() {
  return {
    missed_calls_recovered: 0,
    bookings_captured: 0,
    leads_qualified: 0,
    average_response_minutes: 0,
  };
}

function toConversation(row: AiConversationRow, messages: AiMessage[], actions: AiAgentAction[], impacts: AiCrmImpact[]): AiConversation {
  return {
    id: row.id,
    scenario_key: row.scenario_key,
    title: row.title,
    subtitle: row.subtitle,
    channel: row.channel,
    customer_name: row.customer_name,
    customer_handle: row.customer_handle,
    inbound_label: row.inbound_label,
    summary: row.summary,
    final_outcome: row.final_outcome,
    roi_metrics: {
      missed_calls_recovered: Number(row.roi_metrics?.missed_calls_recovered ?? 0),
      bookings_captured: Number(row.roi_metrics?.bookings_captured ?? 0),
      leads_qualified: Number(row.roi_metrics?.leads_qualified ?? 0),
      average_response_minutes: Number(row.roi_metrics?.average_response_minutes ?? 0),
    },
    extracted_entities: Object.fromEntries(
      Object.entries(asRecord(row.extracted_entities)).map(([key, value]) => [key, String(value)]),
    ),
    is_demo: Boolean(row.is_demo),
    demo_scenario_key: row.demo_scenario_key ?? null,
    created_at: row.created_at,
    messages,
    actions,
    impacts,
  };
}

function buildSessionFromRows(
  row: AiConversationRow,
  messages: AiMessage[],
  actions: AiAgentAction[],
  impacts: AiCrmImpact[],
  platformRecord: PlatformConversationRecord | null,
): LiveFrontDeskSession {
  const extracted = asRecord(row.extracted_entities);
  const status =
    platformRecord?.bookingAppointment
      ? "booked"
      : normalizeLiveStatus(extracted.live_status);

  return {
    conversation: toConversation(row, messages, actions, impacts),
    status,
    latestError: asString(extracted.live_error),
    platformRecord,
  };
}

function buildSessionListItem(row: AiConversationRow): LiveFrontDeskSessionListItem {
  const extracted = asRecord(row.extracted_entities);
  return {
    id: row.id,
    title: row.title,
    channel: row.channel === "sms" || row.channel === "whatsapp" || row.channel === "web_chat" ? row.channel : "web_chat",
    customerName: row.customer_name,
    status: normalizeLiveStatus(extracted.live_status),
    updatedAt: asString(row.updated_at) ?? row.created_at,
  };
}

function buildChannelLabel(channel: LiveConversationChannel) {
  switch (channel) {
    case "sms":
      return "SMS";
    case "whatsapp":
      return "WhatsApp";
    case "web_chat":
      return "Web chat";
  }
}

function buildAssistantLabel(channel: LiveConversationChannel) {
  switch (channel) {
    case "sms":
      return "AI SMS Agent";
    case "whatsapp":
      return "AI WhatsApp Agent";
    case "web_chat":
      return "AI Web Chat Agent";
  }
}

export function normalizePlatformConversationChannel(channel: LiveConversationChannel) {
  return channel === "web_chat" ? "webchat" : channel;
}

export function canAccessLiveFrontDeskTester(input: { tenantId?: string | null; role?: string | null | undefined }) {
  return input.tenantId === liveFrontDeskTesterTenantId && (input.role === "management" || input.role === "admin");
}

export async function listRecentLiveFrontDeskSessions(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 10,
) {
  const env = getCrmEnv();
  if (env.crmE2ePlatformFixturesEnabled) {
    return [] as LiveFrontDeskSessionListItem[];
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("ai_conversations")
    .select("id, scenario_key, title, subtitle, channel, customer_name, customer_handle, inbound_label, summary, final_outcome, roi_metrics, extracted_entities, is_demo, demo_scenario_key, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("is_demo", false)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AiConversationRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(buildSessionListItem);
}

async function getPlatformConversationRecordForLiveSession(
  supabase: SupabaseClient,
  tenantId: string,
  conversationId: string,
): Promise<PlatformConversationRecord | null> {
  const link = await getPlatformConversationLink(supabase, tenantId, conversationId);
  if (!link) {
    return null;
  }

  const [customerResult, leadResult, jobResult, appointmentsResult] = await Promise.all([
    link.customer_id
      ? supabase
          .schema("crm")
          .from("customers")
          .select("id, full_name, phone, email, postcode")
          .eq("tenant_id", tenantId)
          .eq("id", link.customer_id)
          .maybeSingle<PlatformConversationCustomer>()
      : Promise.resolve({ data: null, error: null }),
    link.lead_id
      ? supabase
          .schema("crm")
          .from("leads")
          .select("id, status, source, next_action_at, updated_at")
          .eq("tenant_id", tenantId)
          .eq("id", link.lead_id)
          .maybeSingle<PlatformConversationLead>()
      : Promise.resolve({ data: null, error: null }),
    link.job_id
      ? supabase
          .schema("crm")
          .from("jobs")
          .select("id, title, status, scheduled_date")
          .eq("tenant_id", tenantId)
          .eq("id", link.job_id)
          .maybeSingle<PlatformConversationJob>()
      : Promise.resolve({ data: null, error: null }),
    [link.callback_appointment_id, link.booking_appointment_id].some(Boolean)
      ? supabase
          .schema("crm")
          .from("appointments")
          .select("id, type, title, starts_at, ends_at, status")
          .eq("tenant_id", tenantId)
          .in("id", [link.callback_appointment_id, link.booking_appointment_id].filter((value): value is string => Boolean(value)))
          .returns<PlatformConversationAppointment[]>()
      : Promise.resolve({ data: [] as PlatformConversationAppointment[], error: null }),
  ]);

  if (customerResult.error) {
    throw customerResult.error;
  }
  if (leadResult.error) {
    throw leadResult.error;
  }
  if (jobResult.error) {
    throw jobResult.error;
  }
  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  const appointments = new Map((appointmentsResult.data ?? []).map((appointment) => [appointment.id, appointment]));
  return {
    link,
    customer: customerResult.data ?? null,
    lead: leadResult.data ?? null,
    job: jobResult.data ?? null,
    callbackAppointment: link.callback_appointment_id ? appointments.get(link.callback_appointment_id) ?? null : null,
    bookingAppointment: link.booking_appointment_id ? appointments.get(link.booking_appointment_id) ?? null : null,
  };
}

export async function loadLiveFrontDeskSession(
  supabase: SupabaseClient,
  tenantId: string,
  conversationId: string,
) {
  const env = getCrmEnv();
  if (env.crmE2ePlatformFixturesEnabled) {
    return null;
  }

  const { data: conversation, error: conversationError } = await supabase
    .schema("crm")
    .from("ai_conversations")
    .select("id, scenario_key, title, subtitle, channel, customer_name, customer_handle, inbound_label, summary, final_outcome, roi_metrics, extracted_entities, is_demo, demo_scenario_key, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("is_demo", false)
    .eq("id", conversationId)
    .maybeSingle<AiConversationRow>();

  if (conversationError) {
    throw conversationError;
  }
  if (!conversation) {
    return null;
  }

  const [{ data: messages, error: messagesError }, { data: actions, error: actionsError }, { data: impacts, error: impactsError }, platformRecord] =
    await Promise.all([
      supabase.schema("crm").from("ai_messages").select("*").eq("tenant_id", tenantId).eq("conversation_id", conversationId).order("sort_order").returns<AiMessage[]>(),
      supabase.schema("crm").from("ai_actions").select("*").eq("tenant_id", tenantId).eq("conversation_id", conversationId).order("sort_order").returns<AiAgentAction[]>(),
      supabase.schema("crm").from("ai_crm_impacts").select("*").eq("tenant_id", tenantId).eq("conversation_id", conversationId).order("sort_order").returns<AiCrmImpact[]>(),
      getPlatformConversationRecordForLiveSession(supabase, tenantId, conversationId),
    ]);

  if (messagesError) {
    throw messagesError;
  }
  if (actionsError) {
    throw actionsError;
  }
  if (impactsError) {
    throw impactsError;
  }

  return buildSessionFromRows(conversation, messages ?? [], actions ?? [], impacts ?? [], platformRecord);
}

export async function createLiveFrontDeskSession(
  supabase: SupabaseClient,
  tenantId: string,
  input: z.infer<typeof liveFrontDeskSessionCreateSchema>,
) {
  const parsed = liveFrontDeskSessionCreateSchema.parse(input);
  const conversationId = randomUUID();
  const channelLabel = buildChannelLabel(parsed.channel);
  const now = new Date().toISOString();
  const customerName = parsed.customer_name?.trim() || "Live tester";
  const customerHandle = parsed.phone?.trim() || parsed.email?.trim() || channelLabel;
  const summary = "Internal live front desk tester session.";

  const { error } = await supabase.schema("crm").from("ai_conversations").insert({
    id: conversationId,
    tenant_id: tenantId,
    scenario_key: `live:${parsed.channel}:${conversationId}`,
    title: `Live ${channelLabel} tester`,
    subtitle: "Tenant-1 internal front desk validation",
    channel: parsed.channel,
    customer_name: customerName,
    customer_handle: customerHandle,
    inbound_label: `${channelLabel} session started`,
    summary,
    final_outcome: "Session open.",
    roi_metrics: zeroRoiMetrics(),
    extracted_entities: {
      live_status: "open",
      identity_phone: parsed.phone?.trim() || null,
      identity_email: parsed.email?.trim() || null,
      customer_name: parsed.customer_name?.trim() || null,
      live_source: "tenant_1_internal_tester",
    },
    is_demo: false,
    demo_scenario_key: "core-walkthrough",
    created_at: now,
    updated_at: now,
  });

  if (error) {
    throw error;
  }

  return loadLiveFrontDeskSession(supabase, tenantId, conversationId);
}

async function updateConversationState(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    conversationId: string;
    patch: Partial<Pick<AiConversationRow, "customer_name" | "customer_handle" | "summary" | "final_outcome">>;
    extractedEntities: Record<string, unknown>;
    roiMetrics?: Record<string, unknown>;
  },
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .schema("crm")
    .from("ai_conversations")
    .update({
      ...input.patch,
      extracted_entities: input.extractedEntities,
      roi_metrics: input.roiMetrics ?? zeroRoiMetrics(),
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.conversationId);

  if (error) {
    throw error;
  }
}

async function insertMessages(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    conversationId: string;
    channel: AiConversationChannel;
    startSortOrder: number;
    rows: Array<{ role: AiMessage["role"]; senderLabel: string; body: string }>;
  },
) {
  if (input.rows.length === 0) {
    return;
  }

  const { error } = await supabase.schema("crm").from("ai_messages").insert(
    input.rows.map((row, index) => ({
      id: randomUUID(),
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      sort_order: input.startSortOrder + index,
      offset_seconds: input.startSortOrder + index,
      role: row.role,
      sender_label: row.senderLabel,
      body: row.body,
      channel: input.channel,
      is_demo: false,
      demo_scenario_key: "core-walkthrough",
      created_at: new Date().toISOString(),
    })),
  );

  if (error) {
    throw error;
  }
}

async function insertActions(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    conversationId: string;
    startSortOrder: number;
    rows: Array<{
      agentType: AiAgentAction["agent_type"];
      title: string;
      detail: string;
      statusLabel: string;
    }>;
  },
) {
  if (input.rows.length === 0) {
    return;
  }

  const { error } = await supabase.schema("crm").from("ai_actions").insert(
    input.rows.map((row, index) => ({
      id: randomUUID(),
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      sort_order: input.startSortOrder + index,
      offset_seconds: input.startSortOrder + index,
      agent_type: row.agentType,
      title: row.title,
      detail: row.detail,
      status_label: row.statusLabel,
      is_demo: false,
      demo_scenario_key: "core-walkthrough",
      created_at: new Date().toISOString(),
    })),
  );

  if (error) {
    throw error;
  }
}

export async function appendCustomerMessageToLiveSession(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    conversationId: string;
    channel: LiveConversationChannel;
    customerName: string;
    body: string;
    nextSortOrder: number;
  },
) {
  await insertMessages(supabase, {
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    channel: input.channel,
    startSortOrder: input.nextSortOrder,
    rows: [
      {
        role: "customer",
        senderLabel: input.customerName,
        body: input.body,
      },
    ],
  });
}

export function buildLiveAgentInput(
  alias: WorkspaceAlias,
  session: LiveFrontDeskSession,
): LiveAgentInput {
  const extracted = asRecord(session.conversation.extracted_entities);
  const customer = {
    name: asString(extracted.customer_name) ?? session.conversation.customer_name,
    phone: asString(extracted.identity_phone) ?? undefined,
    email: asString(extracted.identity_email) ?? undefined,
  };

  return {
    tenant_id: alias.tenant_id,
    workspace_id: alias.workspace_id,
    conversation_id: session.conversation.id,
    channel: session.conversation.channel === "sms" || session.conversation.channel === "whatsapp" ? session.conversation.channel : "web_chat",
    customer,
    messages: session.conversation.messages.map((message) => ({
      role: message.role,
      body: message.body,
      sender_label: message.sender_label,
      channel: message.channel ?? undefined,
    })),
  };
}

function buildStatusOutcome(status: LiveTesterStatus, result: LiveAgentResult) {
  switch (status) {
    case "qualified":
      return result.qualification?.summary ?? "Lead qualified.";
    case "booked":
      return result.booking?.slot_label ? `Booking confirmed for ${result.booking.slot_label}.` : "Booking confirmed.";
    case "escalated":
      return "Conversation escalated for human follow-up.";
    case "open":
    default:
      return "Awaiting the next customer message.";
  }
}

export async function applyLiveAgentResult(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    session: LiveFrontDeskSession;
    result: LiveAgentResult;
  },
) {
  const extracted = {
    ...asRecord(input.session.conversation.extracted_entities),
    live_status: input.result.status,
    live_error: null,
    identity_phone: input.result.crm_hints?.identity_phone ?? asString(input.session.conversation.extracted_entities.identity_phone),
    identity_email: input.result.crm_hints?.identity_email ?? asString(input.session.conversation.extracted_entities.identity_email),
    customer_name: input.result.crm_hints?.customer_name ?? input.session.conversation.customer_name,
    service: input.result.qualification?.service ?? null,
    urgency: input.result.qualification?.urgency ?? null,
    booking_uid: input.result.booking?.booking_uid ?? null,
    booking_slot_label: input.result.booking?.slot_label ?? null,
  };

  const roiMetrics = {
    ...zeroRoiMetrics(),
    bookings_captured: input.result.status === "booked" ? 1 : 0,
    leads_qualified: input.result.status === "qualified" || input.result.status === "booked" ? 1 : 0,
  };

  await updateConversationState(supabase, {
    tenantId: input.tenantId,
    conversationId: input.session.conversation.id,
    patch: {
      customer_name: input.result.crm_hints?.customer_name ?? input.session.conversation.customer_name,
      customer_handle:
        input.result.crm_hints?.identity_phone ??
        input.result.crm_hints?.identity_email ??
        input.session.conversation.customer_handle,
      summary: input.result.qualification?.summary ?? input.session.conversation.summary,
      final_outcome: buildStatusOutcome(input.result.status, input.result),
    },
    extractedEntities: extracted,
    roiMetrics,
  });

  const nextMessageSortOrder = input.session.conversation.messages.length + 1;
  await insertMessages(supabase, {
    tenantId: input.tenantId,
    conversationId: input.session.conversation.id,
    channel: input.session.conversation.channel,
    startSortOrder: nextMessageSortOrder,
    rows: input.result.assistant_messages.map((message) => ({
      role: "assistant",
      senderLabel: message.sender_label ?? buildAssistantLabel(input.session.conversation.channel as LiveConversationChannel),
      body: message.body,
    })),
  });

  const nextActionSortOrder = input.session.conversation.actions.length + 1;
  const actionRows: Array<{
    agentType: AiAgentAction["agent_type"];
    title: string;
    detail: string;
    statusLabel: string;
  }> =
    input.result.actions.length > 0
      ? input.result.actions.map((action) => ({
          agentType: action.agent_type,
          title: action.title,
          detail: action.detail,
          statusLabel: action.status_label,
        }))
      : [
          {
            agentType:
              input.result.status === "qualified"
                ? "qualification"
                : input.result.status === "booked"
                  ? "booking"
                  : input.result.status === "escalated"
                    ? "escalation"
                    : "triage",
            title: `Agent marked conversation ${input.result.status}`,
            detail: buildStatusOutcome(input.result.status, input.result),
            statusLabel: "completed",
          },
        ];

  await insertActions(supabase, {
    tenantId: input.tenantId,
    conversationId: input.session.conversation.id,
    startSortOrder: nextActionSortOrder,
    rows: actionRows,
  });
}

export async function recordLiveAgentFailure(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    session: LiveFrontDeskSession;
    message: string;
  },
) {
  await updateConversationState(supabase, {
    tenantId: input.tenantId,
    conversationId: input.session.conversation.id,
    patch: {
      final_outcome: "Agent request failed.",
    },
    extractedEntities: {
      ...asRecord(input.session.conversation.extracted_entities),
      live_error: input.message,
    },
  });

  await insertActions(supabase, {
    tenantId: input.tenantId,
    conversationId: input.session.conversation.id,
    startSortOrder: input.session.conversation.actions.length + 1,
    rows: [
      {
        agentType: "escalation",
        title: "Live agent request failed",
        detail: input.message,
        statusLabel: "failed",
      },
    ],
  });
}

function buildImpactRows(session: LiveFrontDeskSession): Array<{
  impactType: string;
  title: string;
  detail: string;
  crmEntityType: AiCrmImpact["crm_entity_type"];
  crmEntityId: string | null;
  routePath: string | null;
}> {
  const rows: Array<{
    impactType: string;
    title: string;
    detail: string;
    crmEntityType: AiCrmImpact["crm_entity_type"];
    crmEntityId: string | null;
    routePath: string | null;
  }> = [];

  if (session.platformRecord?.customer) {
    rows.push({
      impactType: "customer_linked",
      title: "Customer linked",
      detail: `${session.platformRecord.customer.full_name} is linked to this conversation.`,
      crmEntityType: "customer",
      crmEntityId: session.platformRecord.customer.id,
      routePath: `/customers/${session.platformRecord.customer.id}`,
    });
  }
  if (session.platformRecord?.lead) {
    rows.push({
      impactType: "lead_linked",
      title: "Lead updated",
      detail: `Lead status is ${session.platformRecord.lead.status}.`,
      crmEntityType: "lead",
      crmEntityId: session.platformRecord.lead.id,
      routePath: "/leads",
    });
  }
  if (session.platformRecord?.bookingAppointment) {
    rows.push({
      impactType: "booking_created",
      title: "Booking appointment created",
      detail: `${session.platformRecord.bookingAppointment.title} is now visible in the calendar.`,
      crmEntityType: "appointment",
      crmEntityId: session.platformRecord.bookingAppointment.id,
      routePath: "/calendar",
    });
  }
  if (session.platformRecord?.callbackAppointment) {
    rows.push({
      impactType: "follow_up_created",
      title: "Follow-up appointment created",
      detail: `${session.platformRecord.callbackAppointment.title} is now visible in the calendar.`,
      crmEntityType: "appointment",
      crmEntityId: session.platformRecord.callbackAppointment.id,
      routePath: "/calendar",
    });
  }
  if (session.platformRecord?.job) {
    rows.push({
      impactType: "job_linked",
      title: "Job linked",
      detail: `${session.platformRecord.job.title} is linked to the conversation.`,
      crmEntityType: "job",
      crmEntityId: session.platformRecord.job.id,
      routePath: `/jobs/${session.platformRecord.job.id}`,
    });
  }

  return rows;
}

export async function syncLiveConversationImpacts(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    conversationId: string;
    session: LiveFrontDeskSession;
  },
) {
  const { error: deleteError } = await supabase
    .schema("crm")
    .from("ai_crm_impacts")
    .delete()
    .eq("tenant_id", input.tenantId)
    .eq("conversation_id", input.conversationId);

  if (deleteError) {
    throw deleteError;
  }

  const rows = buildImpactRows(input.session);
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.schema("crm").from("ai_crm_impacts").insert(
    rows.map((row, index) => ({
      id: randomUUID(),
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      sort_order: index + 1,
      offset_seconds: index + 1,
      impact_type: row.impactType,
      title: row.title,
      detail: row.detail,
      crm_entity_type: row.crmEntityType,
      crm_entity_id: row.crmEntityId,
      route_path: row.routePath,
      is_demo: false,
      demo_scenario_key: "core-walkthrough",
      created_at: new Date().toISOString(),
    })),
  );

  if (error) {
    throw error;
  }
}

function buildCommonPlatformPayload(
  session: LiveFrontDeskSession,
  result: LiveAgentResult,
  occurredAt: string,
  customerMessageBody: string,
) {
  const extracted = asRecord(session.conversation.extracted_entities);

  return {
    channel: normalizePlatformConversationChannel(session.conversation.channel as LiveConversationChannel),
    occurred_at: occurredAt,
    customerName: result.crm_hints?.customer_name ?? asString(extracted.customer_name) ?? session.conversation.customer_name,
    customerPhone: result.crm_hints?.identity_phone ?? asString(extracted.identity_phone),
    customerEmail: result.crm_hints?.identity_email ?? asString(extracted.identity_email),
    identity_phone: result.crm_hints?.identity_phone ?? asString(extracted.identity_phone),
    identity_email: result.crm_hints?.identity_email ?? asString(extracted.identity_email),
    message_summary: result.qualification?.summary ?? customerMessageBody,
    serviceCategory: result.qualification?.service ?? null,
    reason: result.qualification?.urgency ?? null,
    job_id: result.crm_hints?.job_id ?? null,
  };
}

export function buildPlatformEventsFromLiveAgentResult(input: {
  alias: WorkspaceAlias;
  session: LiveFrontDeskSession;
  result: LiveAgentResult;
  customerMessageBody: string;
  conversationStarted: boolean;
}) {
  const occurredAt = new Date().toISOString();
  const commonPayload = buildCommonPlatformPayload(input.session, input.result, occurredAt, input.customerMessageBody);
  const events: Array<{
    event_id: string;
    event_type: "ConversationStarted" | "ConversationQualified" | "BookingConfirmed" | "EscalationRaised";
    event_version: 1;
    workspace_id: string;
    occurred_at: string;
    source_system: "agentic_runtime";
    idempotency_key: string;
    correlation_id: string;
    causation_id: null;
    aggregate: {
      type: "conversation";
      id: string;
    };
    payload: Record<string, unknown>;
  }> = [];

  if (!input.conversationStarted) {
    events.push({
      event_id: randomUUID(),
      event_type: "ConversationStarted",
      event_version: 1,
      workspace_id: input.alias.workspace_id,
      occurred_at: occurredAt,
      source_system: "agentic_runtime",
      idempotency_key: `${input.session.conversation.id}:started:${occurredAt}`,
      correlation_id: input.session.conversation.id,
      causation_id: null,
      aggregate: {
        type: "conversation",
        id: input.session.conversation.id,
      },
      payload: commonPayload,
    });
  }

  if (input.result.status === "qualified" || input.result.status === "booked") {
    events.push({
      event_id: randomUUID(),
      event_type: "ConversationQualified",
      event_version: 1,
      workspace_id: input.alias.workspace_id,
      occurred_at: occurredAt,
      source_system: "agentic_runtime",
      idempotency_key: `${input.session.conversation.id}:qualified:${occurredAt}`,
      correlation_id: input.session.conversation.id,
      causation_id: null,
      aggregate: {
        type: "conversation",
        id: input.session.conversation.id,
      },
      payload: commonPayload,
    });
  }

  if (input.result.status === "booked" && input.result.booking) {
    events.push({
      event_id: randomUUID(),
      event_type: "BookingConfirmed",
      event_version: 1,
      workspace_id: input.alias.workspace_id,
      occurred_at: occurredAt,
      source_system: "agentic_runtime",
      idempotency_key: `${input.session.conversation.id}:booked:${occurredAt}`,
      correlation_id: input.session.conversation.id,
      causation_id: null,
      aggregate: {
        type: "conversation",
        id: input.session.conversation.id,
      },
      payload: {
        ...commonPayload,
        booking_start_at: input.result.booking.start_at,
        booking_end_at: input.result.booking.end_at,
        booking_slot_label: input.result.booking.slot_label ?? null,
        booking_uid: input.result.booking.booking_uid ?? null,
      },
    });
  }

  if (input.result.status === "escalated") {
    events.push({
      event_id: randomUUID(),
      event_type: "EscalationRaised",
      event_version: 1,
      workspace_id: input.alias.workspace_id,
      occurred_at: occurredAt,
      source_system: "agentic_runtime",
      idempotency_key: `${input.session.conversation.id}:escalated:${occurredAt}`,
      correlation_id: input.session.conversation.id,
      causation_id: null,
      aggregate: {
        type: "conversation",
        id: input.session.conversation.id,
      },
      payload: {
        ...commonPayload,
        trigger: input.result.qualification?.urgency ?? "live_agent_escalation",
        response_text: input.result.assistant_messages.at(-1)?.body ?? "Conversation escalated for manual handling.",
      },
    });
  }

  return events;
}

export async function resolveLiveSessionWorkspaceAlias(supabase: SupabaseClient, tenantId: string) {
  return getWorkspaceAlias(supabase, tenantId);
}
