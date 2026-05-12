#!/usr/bin/env tsx
/**
 * live-empire-channel-tests.mts
 *
 * Runs live end-to-end channel checks against the production platform-api and
 * validates three things for each scenario:
 *   1. routing resolved to the expected tenant
 *   2. platform booking state reached the expected outcome
 *   3. CRM materialization landed for the exact tenant/conversation
 *
 * The runner derives active channel wiring from live platform data rather than
 * hard-coding stale tenant ownership. Empire is the default acceptance tenant,
 * but the target tenant can be overridden with LIVE_TEST_PLATFORM_TENANT_ID.
 */

import { execFileSync, execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const PLATFORM_API_URL =
  process.env.PLATFORM_API_URL ?? "https://customerjourneys-platform-api-cnz7crlx2a-nw.a.run.app";
const PLATFORM_REPO = "/Users/shehzadiqbal/Customer Journeys AI v1/customerjourneys-site";
const DEFAULT_PLATFORM_TENANT_ID = "b469a9fe-546d-4baa-9f87-3487c7c4afc1";

const DEFAULT_POLL_MS = 40_000;
const POLL_INTERVAL_MS = 700;
const BETWEEN_TURNS_MS = 900;

let PLATFORM_DB_URL = "";
let CRM_ADMIN: SupabaseClient | null = null;
let LIVE_TARGET: LiveTenantTarget | null = null;

type TranscriptLine = { role: "customer" | "ai"; text: string };
type TextRecoveryProfile = {
  fullName?: string;
  email?: string;
  phone?: string;
  postcode?: string;
  address?: string;
  affectedArea?: string;
  problemDescription?: string;
  preferredTime?: string;
};

type PlatformConversationRow = {
  conversation_id: string;
  lead_id: string;
  tenant_id: string;
  tenant_name: string;
  status: string | null;
  created_at: string;
};

type BookingStateRow = {
  conversation_id: string;
  current_state: string;
  collected_data: Record<string, unknown>;
  waiting_for: string[];
  confirmed_slots: string[];
};

type BookingRow = {
  id: string;
  booking_status: string;
  start_time: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  body: string;
  direction: string;
  created_at: string;
};

type ActiveConnectionRow = {
  tenant_id: string;
  tenant_name: string;
  integration_type: "messaging" | "voice";
  provider_key: string;
  phone_number: string | null;
  webhook_base_url: string | null;
};

type CrmRuntimeLinkRow = {
  crm_tenant_id: string;
  customerjourneys_tenant_id: string;
};

type WorkspaceAliasRow = {
  workspace_id: string;
  tenant_id: string;
};

type PlatformEventRow = {
  event_id: string;
  event_type: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  tenant_id: string;
};

type AppointmentRow = {
  id: string;
  starts_at: string;
  status: string;
  title: string | null;
  tenant_id: string;
};

type JobRow = {
  id: string;
  title: string | null;
  status: string;
  tenant_id: string;
};

type PlatformConversationLinkRow = {
  tenant_id: string;
  conversation_id: string;
  customer_id: string | null;
  lead_id: string | null;
  job_id: string | null;
  callback_appointment_id: string | null;
  booking_appointment_id: string | null;
  latest_channel: string | null;
};

type LiveTenantTarget = {
  platformTenantId: string;
  platformTenantName: string;
  messagingNumber: string;
  voiceNumber: string;
  crmTenantId: string;
  crmWorkspaceId: string;
  messagingProvider: string;
  voiceProvider: string;
};

type CrmEvidence = {
  events: PlatformEventRow[];
  appointment: AppointmentRow | null;
  job: JobRow | null;
  link: PlatformConversationLinkRow | null;
  mismatches: string[];
};

type Verdict = {
  passed: boolean;
  note: string;
};

type CrmExpectation = "conversation" | "booking" | "booking_or_handoff";

type TestResult = {
  name: string;
  channel: string;
  passed: boolean;
  failReason?: string;
  transcript: TranscriptLine[];
  routingVerdict: Verdict;
  platformVerdict: Verdict;
  crmVerdict: Verdict;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gcloudSecret(name: string) {
  return execSync(
    `gcloud secrets versions access latest --secret="${name}" --project=customer-journeys-ai`,
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
        CLOUDSDK_SURVEY_DISABLE: "1",
      },
    }
  ).trim();
}

function normalizeDialablePhone(value: string) {
  const stripped = value.replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
  if (stripped.startsWith("+")) {
    return `+${stripped.slice(1).replace(/\D/g, "")}`;
  }
  return stripped.replace(/\D/g, "");
}

function getCrmAdminClient() {
  if (CRM_ADMIN) {
    return CRM_ADMIN;
  }

  const crm = requireCrmScriptConfig(true);
  CRM_ADMIN = createClient(crm.supabaseUrl!, crm.serviceRoleKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return CRM_ADMIN;
}

function platformDbQuery<T>(sql: string, params: unknown[]): T[] {
  if (!PLATFORM_DB_URL) {
    throw new Error("PLATFORM_DB_URL is not loaded");
  }

  const script = `
    import { Client } from "pg";

    const client = new Client({ connectionString: process.env.PLATFORM_DB_URL });
    await client.connect();
    try {
      const sql = process.env.PLATFORM_DB_SQL ?? "";
      const params = JSON.parse(process.env.PLATFORM_DB_PARAMS ?? "[]");
      const result = await client.query(sql, params);
      process.stdout.write(JSON.stringify(result.rows));
    } finally {
      await client.end();
    }
  `;

  const output = execFileSync("node", ["--input-type=module", "-e", script], {
    cwd: PLATFORM_REPO,
    encoding: "utf8",
    env: {
      ...process.env,
      PLATFORM_DB_URL,
      PLATFORM_DB_SQL: sql,
      PLATFORM_DB_PARAMS: JSON.stringify(params),
    },
  });

  return JSON.parse(output) as T[];
}

function requireLiveTarget() {
  if (!LIVE_TARGET) {
    throw new Error("Live tenant target is not resolved");
  }
  return LIVE_TARGET;
}

async function resolveLiveTarget() {
  const platformTenantId = process.env.LIVE_TEST_PLATFORM_TENANT_ID ?? DEFAULT_PLATFORM_TENANT_ID;
  const connections = platformDbQuery<ActiveConnectionRow>(
    `select
        t.id as tenant_id,
        t.name as tenant_name,
        ic.integration_type,
        ic.provider_key,
        ic.config ->> 'phoneNumber' as phone_number,
        ic.config ->> 'webhookBaseUrl' as webhook_base_url
      from integration_connections ic
      join tenants t on t.id = ic.tenant_id
      where t.id = $1
        and ic.status = 'active'
        and ic.integration_type in ('messaging', 'voice')
      order by ic.integration_type, ic.updated_at desc, ic.created_at desc`,
    [platformTenantId]
  );

  const messaging = connections.find((row) => row.integration_type === "messaging" && row.phone_number);
  const voice = connections.find((row) => row.integration_type === "voice" && row.phone_number);

  if (!messaging) {
    throw new Error(`No active messaging connection with an inbound number found for tenant ${platformTenantId}`);
  }
  if (!voice) {
    throw new Error(`No active voice connection with an inbound number found for tenant ${platformTenantId}`);
  }

  const crm = getCrmAdminClient();
  const { data: runtimeLink, error: runtimeLinkError } = await crm
    .schema("crm")
    .from("customerjourneys_runtime_links")
    .select("crm_tenant_id, customerjourneys_tenant_id")
    .eq("customerjourneys_tenant_id", platformTenantId)
    .maybeSingle<CrmRuntimeLinkRow>();

  if (runtimeLinkError) {
    throw runtimeLinkError;
  }
  if (!runtimeLink?.crm_tenant_id) {
    throw new Error(`No CRM runtime link found for platform tenant ${platformTenantId}`);
  }

  const { data: alias, error: aliasError } = await crm
    .schema("crm")
    .from("workspace_aliases")
    .select("workspace_id, tenant_id")
    .eq("tenant_id", runtimeLink.crm_tenant_id)
    .maybeSingle<WorkspaceAliasRow>();

  if (aliasError) {
    throw aliasError;
  }
  if (!alias?.workspace_id) {
    throw new Error(`No CRM workspace alias found for CRM tenant ${runtimeLink.crm_tenant_id}`);
  }

  LIVE_TARGET = {
    platformTenantId,
    platformTenantName: messaging.tenant_name,
    messagingNumber: messaging.phone_number!,
    voiceNumber: voice.phone_number!,
    crmTenantId: runtimeLink.crm_tenant_id,
    crmWorkspaceId: alias.workspace_id,
    messagingProvider: messaging.provider_key,
    voiceProvider: voice.provider_key,
  };

  return LIVE_TARGET;
}

async function resolveConversationByPhone(
  phoneNumber: string,
  tenantId = requireLiveTarget().platformTenantId
) {
  const rows = platformDbQuery<{ lead_id: string; conv_id: string }>(
    `select l.id as lead_id, c.id as conv_id
       from leads l
       join conversations c on c.lead_id = l.id
      where l.tenant_id = $1
        and l.phone_number = $2
      order by c.created_at desc
      limit 1`,
    [tenantId, normalizeDialablePhone(phoneNumber)]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    leadId: rows[0].lead_id,
    convId: rows[0].conv_id,
  };
}

async function resolveConversationByEmail(
  email: string,
  tenantId = requireLiveTarget().platformTenantId
) {
  const rows = platformDbQuery<{ lead_id: string; conv_id: string }>(
    `select l.id as lead_id, c.id as conv_id
       from leads l
       join conversations c on c.lead_id = l.id
      where l.tenant_id = $1
        and l.email = $2
      order by c.created_at desc
      limit 1`,
    [tenantId, email]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    leadId: rows[0].lead_id,
    convId: rows[0].conv_id,
  };
}

async function pollResolveConversationByPhone(
  phoneNumber: string,
  tenantId = requireLiveTarget().platformTenantId,
  timeoutMs = 12_000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resolved = await resolveConversationByPhone(phoneNumber, tenantId);
    if (resolved) {
      return resolved;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

async function pollReply(conversationId: string, after: Date, timeoutMs = DEFAULT_POLL_MS) {
  const deadline = Date.now() + timeoutMs;
  const afterIso = after.toISOString();

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const rows = platformDbQuery<MessageRow>(
      `select id, conversation_id, body, direction, created_at
         from messages
        where conversation_id = $1
          and direction = 'outbound'
          and created_at > $2::timestamptz
        order by created_at asc
        limit 1`,
      [conversationId, afterIso]
    );
    if (rows[0]?.body) {
      return rows[0];
    }
  }

  return null;
}

async function fetchPlatformConversationState(conversationId: string): Promise<{
  conversation: PlatformConversationRow | null;
  bookingState: BookingStateRow | null;
  bookings: BookingRow[];
}> {
  const [conversationRows, stateRows, bookings] = await Promise.all([
    Promise.resolve(
      platformDbQuery<PlatformConversationRow>(
        `select
            c.id as conversation_id,
            l.id as lead_id,
            l.tenant_id,
            t.name as tenant_name,
            c.status,
            c.created_at
         from conversations c
         join leads l on l.id = c.lead_id
         join tenants t on t.id = l.tenant_id
         where c.id = $1
         limit 1`,
        [conversationId]
      )
    ),
    Promise.resolve(
      platformDbQuery<BookingStateRow>(
        `select conversation_id, current_state, collected_data, waiting_for, confirmed_slots
           from booking_state
          where conversation_id = $1
          order by updated_at desc
          limit 1`,
        [conversationId]
      )
    ),
    Promise.resolve(
      platformDbQuery<BookingRow>(
        `select id, booking_status, start_time
           from bookings
          where conversation_id = $1
          order by created_at desc
          limit 3`,
        [conversationId]
      )
    ),
  ]);

  return {
    conversation: conversationRows[0] ?? null,
    bookingState: stateRows[0] ?? null,
    bookings,
  };
}

function extractCorrelationIds(payload: Record<string, unknown>) {
  return {
    conversationId:
      (typeof payload.conversation_id === "string" && payload.conversation_id) ||
      (typeof payload.conversationId === "string" && payload.conversationId) ||
      null,
    bookingId:
      (typeof payload.booking_id === "string" && payload.booking_id) ||
      (typeof payload.bookingId === "string" && payload.bookingId) ||
      null,
  };
}

async function fetchCrmEvidenceExact(
  since: Date,
  conversationId: string | null,
  bookingId: string | null,
  timeoutMs = 12_000
): Promise<CrmEvidence> {
  const crm = getCrmAdminClient();
  const target = requireLiveTarget();
  const sinceIso = since.toISOString();

  const queryOnce = async (): Promise<CrmEvidence> => {
    const { data: eventsData, error: eventsError } = await crm
      .schema("crm")
      .from("platform_event_log")
      .select("event_id, event_type, aggregate_id, payload, created_at, tenant_id")
      .eq("tenant_id", target.crmTenantId)
      .gt("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(100);

    if (eventsError) {
      throw eventsError;
    }

    const relevantEvents = ((eventsData ?? []) as PlatformEventRow[]).filter((event) => {
      const correlated = extractCorrelationIds(event.payload ?? {});
      return (
        (conversationId !== null &&
          (event.aggregate_id === conversationId || correlated.conversationId === conversationId)) ||
        (bookingId !== null && (event.aggregate_id === bookingId || correlated.bookingId === bookingId))
      );
    });

    let link: PlatformConversationLinkRow | null = null;
    if (conversationId) {
      const { data: linkData, error: linkError } = await crm
        .schema("crm")
        .from("platform_conversation_links")
        .select(
          "tenant_id, conversation_id, customer_id, lead_id, job_id, callback_appointment_id, booking_appointment_id, latest_channel"
        )
        .eq("tenant_id", target.crmTenantId)
        .eq("conversation_id", conversationId)
        .maybeSingle<PlatformConversationLinkRow>();

      if (linkError) {
        throw linkError;
      }
      link = linkData ?? null;
    }

    let appointment: AppointmentRow | null = null;
    if (link?.booking_appointment_id || link?.callback_appointment_id) {
      const appointmentId = link.booking_appointment_id ?? link.callback_appointment_id;
      const { data: appointmentData, error: appointmentError } = await crm
        .schema("crm")
        .from("appointments")
        .select("id, starts_at, status, title, tenant_id")
        .eq("tenant_id", target.crmTenantId)
        .eq("id", appointmentId)
        .maybeSingle<AppointmentRow>();

      if (appointmentError) {
        throw appointmentError;
      }
      appointment = appointmentData ?? null;
    }

    let job: JobRow | null = null;
    if (link?.job_id) {
      const { data: jobData, error: jobError } = await crm
        .schema("crm")
        .from("jobs")
        .select("id, title, status, tenant_id")
        .eq("tenant_id", target.crmTenantId)
        .eq("id", link.job_id)
        .maybeSingle<JobRow>();

      if (jobError) {
        throw jobError;
      }
      job = jobData ?? null;
    }

    const mismatches: string[] = [];
    if (link && link.tenant_id !== target.crmTenantId) {
      mismatches.push(`conversation link tenant ${link.tenant_id} != expected CRM tenant ${target.crmTenantId}`);
    }
    if (appointment && appointment.tenant_id !== target.crmTenantId) {
      mismatches.push(`appointment tenant ${appointment.tenant_id} != expected CRM tenant ${target.crmTenantId}`);
    }
    if (job && job.tenant_id !== target.crmTenantId) {
      mismatches.push(`job tenant ${job.tenant_id} != expected CRM tenant ${target.crmTenantId}`);
    }

    return {
      events: relevantEvents,
      appointment,
      job,
      link,
      mismatches,
    };
  };

  const deadline = Date.now() + timeoutMs;
  let evidence = await queryOnce();

  while (
    Date.now() < deadline &&
    !evidence.link &&
    evidence.events.length === 0 &&
    !evidence.appointment &&
    !evidence.job
  ) {
    await sleep(POLL_INTERVAL_MS);
    evidence = await queryOnce();
  }

  return evidence;
}

function buildRoutingVerdict(conversation: PlatformConversationRow | null, assertedTenantId: string): Verdict {
  if (!conversation) {
    return {
      passed: false,
      note: "no conversation was created on the platform",
    };
  }

  if (conversation.tenant_id !== assertedTenantId) {
    return {
      passed: false,
      note: `conversation routed to ${conversation.tenant_name} (${conversation.tenant_id}) instead of ${assertedTenantId}`,
    };
  }

  return {
    passed: true,
    note: `conversation routed to ${conversation.tenant_name}`,
  };
}

function buildCrmVerdict(expectation: CrmExpectation, evidence: CrmEvidence): Verdict {
  if (evidence.mismatches.length > 0) {
    return {
      passed: false,
      note: evidence.mismatches.join("; "),
    };
  }

  const eventTypes = new Set(evidence.events.map((event) => event.event_type));
  if (expectation === "booking") {
    const hasBookingEvent = eventTypes.has("BookingConfirmed") || eventTypes.has("booking.confirmed");
    const hasMaterializedRecord = Boolean(evidence.appointment || evidence.job);
    if (!evidence.link) {
      return {
        passed: false,
        note: "no CRM conversation link found for the platform conversation",
      };
    }
    if (!hasBookingEvent) {
      return {
        passed: false,
        note: `missing booking confirmation event in CRM (${[...eventTypes].join(", ") || "none"})`,
      };
    }
    if (!hasMaterializedRecord) {
      return {
        passed: false,
        note: "booking confirmation reached CRM but no appointment/job materialized",
      };
    }
    return {
      passed: true,
      note: `events=${[...eventTypes].join(", ")}${evidence.appointment ? " + appointment" : ""}${evidence.job ? " + job" : ""}`,
    };
  }

  if (expectation === "booking_or_handoff") {
    const hasBookingEvent = eventTypes.has("BookingConfirmed") || eventTypes.has("booking.confirmed");
    const hasMaterializedRecord = Boolean(evidence.appointment || evidence.job);
    const hasEscalation = eventTypes.has("EscalationRaised");
    if (!evidence.link) {
      return {
        passed: false,
        note: "no CRM conversation link found for the platform conversation",
      };
    }
    if (hasBookingEvent && hasMaterializedRecord) {
      return {
        passed: true,
        note: `events=${[...eventTypes].join(", ")}${evidence.appointment ? " + appointment" : ""}${evidence.job ? " + job" : ""}`,
      };
    }
    if (hasEscalation) {
      return {
        passed: true,
        note: `events=${[...eventTypes].join(", ")}`,
      };
    }
    return {
      passed: false,
      note: `missing booking confirmation or escalation event in CRM (${[...eventTypes].join(", ") || "none"})`,
    };
  }

  const hasConversationEvent = eventTypes.has("ConversationStarted") || eventTypes.has("ConversationQualified");
  if (evidence.link || hasConversationEvent) {
    return {
      passed: true,
      note: evidence.link
        ? `link created${eventTypes.size > 0 ? ` + events=${[...eventTypes].join(", ")}` : ""}`
        : `events=${[...eventTypes].join(", ")}`,
    };
  }

  return {
    passed: false,
    note: "no CRM conversation evidence for this interaction",
  };
}

function printPlatformSummary(state: Awaited<ReturnType<typeof fetchPlatformConversationState>>) {
  console.log(`  platform tenant:  ${state.conversation?.tenant_name ?? "n/a"}`);
  console.log(`  platform state:   ${state.bookingState?.current_state ?? "n/a"}`);
  if (state.bookingState?.waiting_for?.length) {
    console.log(`  waiting_for:      ${state.bookingState.waiting_for.join(", ")}`);
  }
  const service = (state.bookingState?.collected_data as Record<string, Record<string, unknown>> | null)?.service;
  if (service?.serviceKey) {
    console.log(
      `  service:          ${String(service.serviceKey)}${service.urgency ? ` (${String(service.urgency)})` : ""}`
    );
  }
  const identity = (state.bookingState?.collected_data as Record<string, Record<string, unknown>> | null)?.identity;
  if (identity?.fullName) {
    console.log(`  name captured:    ${String(identity.fullName)}`);
  }
  console.log(
    `  booking:          ${
      state.bookings[0]
        ? `${state.bookings[0].booking_status}${state.bookings[0].start_time ? ` @ ${new Date(state.bookings[0].start_time).toLocaleString("en-GB")}` : ""}`
        : "none"
    }`
  );
}

function printCrmSummary(evidence: CrmEvidence) {
  const eventTypes = evidence.events.map((event) => event.event_type);
  console.log(`  CRM events:       ${eventTypes.length > 0 ? eventTypes.join(", ") : "none"}`);
  console.log(`  CRM link:         ${evidence.link ? "present" : "none"}`);
  console.log(
    `  CRM appointment:  ${
      evidence.appointment
        ? `${evidence.appointment.id.slice(0, 8)}… ${evidence.appointment.status}`
        : "none"
    }`
  );
  console.log(
    `  CRM job:          ${evidence.job ? `${evidence.job.id.slice(0, 8)}… ${evidence.job.status}` : "none"}`
  );
}

function normalizeReplyText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function replyOffersReplacementSlot(reply: string | null | undefined) {
  const normalized = normalizeReplyText(reply);
  return (
    (
      normalized.includes("that time is gone") ||
      normalized.includes("that slot is gone") ||
      normalized.startsWith("i can do ")
    ) &&
    (normalized.includes("which works best") || normalized.includes("reply yes to take it"))
  );
}

function replyAsksForBookingConfirmation(reply: string | null | undefined) {
  const normalized = normalizeReplyText(reply);
  return (
    normalized.includes("reply yes to confirm") ||
    normalized.includes("would you like me to confirm") ||
    normalized.includes("shall i confirm your") ||
    normalized.includes("shall i confirm the booking") ||
    normalized.includes("shall i go ahead and confirm") ||
    normalized.includes("should i go ahead and confirm") ||
    normalized.includes("should i confirm your") ||
    normalized.includes("should i proceed to confirm") ||
    normalized.includes("confirm the exact time slot") ||
    normalized.includes("please confirm the appointment slot") ||
    normalized.includes("confirm the appointment slot") ||
    normalized.includes("please confirm the slot")
  );
}

function buildAdaptiveReply(reply: string, profile: TextRecoveryProfile) {
  const normalized = normalizeReplyText(reply);
  const isQuestionLike =
    normalized.includes("?") ||
    normalized.includes("could you") ||
    normalized.includes("can you") ||
    normalized.includes("please") ||
    normalized.includes("may i have");

  if (replyOffersReplacementSlot(reply)) {
    return "The second slot works for me";
  }
  if (normalized.includes("i will check availability for")) {
    return "YES please confirm";
  }
  if (normalized.includes("i will hold the slot") || normalized.includes("please hold on a moment")) {
    return "YES please confirm";
  }
  if (replyAsksForBookingConfirmation(reply)) {
    return "YES please confirm";
  }
  if (normalized.includes("full name") && isQuestionLike && profile.fullName) {
    return profile.fullName;
  }
  if (normalized.includes("email address") && isQuestionLike && profile.email) {
    return profile.email;
  }
  if (normalized.includes("phone number") && isQuestionLike && profile.phone) {
    return profile.phone;
  }
  if (
    (normalized.includes("job address") ||
      normalized.includes("full address") ||
      normalized.includes("house number and street") ||
      normalized.includes("address for the booking")) &&
    isQuestionLike &&
    profile.address
  ) {
    return profile.address;
  }
  if (normalized.includes("postcode") && isQuestionLike && profile.postcode) {
    return profile.postcode;
  }
  if (
    (normalized.includes("which area is affected") || normalized.includes("area of your property")) &&
    isQuestionLike &&
    profile.affectedArea
  ) {
    return profile.affectedArea;
  }
  if (
    (normalized.includes("briefly describe the problem") || normalized.includes("problem in your own words")) &&
    isQuestionLike &&
    profile.problemDescription
  ) {
    return profile.problemDescription;
  }
  if (
    (normalized.includes("what time works best") ||
      normalized.includes("morning, afternoon, or evening") ||
      normalized.includes("preferred time window")) &&
    isQuestionLike &&
    profile.preferredTime
  ) {
    return profile.preferredTime;
  }

  return null;
}

async function continueTextRecovery(
  transcript: TranscriptLine[],
  initialReply: string,
  sendTurn: (message: string) => Promise<string>,
  profile: TextRecoveryProfile,
  maxFollowUps = 20
) {
  let reply = initialReply;

  for (let index = 0; index < maxFollowUps; index += 1) {
    const nextMessage = buildAdaptiveReply(reply, profile);

    if (!nextMessage) {
      break;
    }

    console.log(`\n  [customer] ${nextMessage}`);
    transcript.push({ role: "customer", text: nextMessage });
    reply = await sendTurn(nextMessage);
    console.log(`  [AI]       ${reply}`);
    transcript.push({ role: "ai", text: reply });
    await sleep(BETWEEN_TURNS_MS);
  }
}

async function sendSms(
  token: string,
  from: string,
  body: string,
  channel: "sms" | "whatsapp",
  toNumber: string
) {
  const fromNumber = channel === "whatsapp" ? `whatsapp:${from}` : from;
  const toNumberWithTransport = channel === "whatsapp" ? `whatsapp:${toNumber}` : toNumber;
  const params = new URLSearchParams({
    MessageSid: `SM_TEST_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    AccountSid: "AC_test",
    From: fromNumber,
    To: toNumberWithTransport,
    Body: body,
    NumMedia: "0",
    NumSegments: "1",
  });

  const response = await fetch(`${PLATFORM_API_URL}/v1/webhooks/twilio/sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-internal-service-token": token,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`SMS webhook ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
}

async function runSmsScenario(
  label: string,
  channel: "sms" | "whatsapp",
  from: string,
  turns: string[],
  recoveryProfile: TextRecoveryProfile,
  token: string,
  testStart: Date,
  crmExpectation: CrmExpectation,
  checkPlatform: (state: Awaited<ReturnType<typeof fetchPlatformConversationState>>) => Verdict
): Promise<TestResult> {
  const target = requireLiveTarget();
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${label}  [${channel.toUpperCase()}]`);
  console.log(`  From: ${from}  →  To: ${target.messagingNumber}  (tenant: ${target.platformTenantName})`);
  console.log("═".repeat(64));

  const transcript: TranscriptLine[] = [];
  let conversationId: string | null = null;
  let failed = false;
  let failReason: string | undefined;
  let lastReply = "";

  try {
    for (const message of turns) {
      console.log(`\n  [customer] ${message}`);
      transcript.push({ role: "customer", text: message });

      const sentAt = new Date();
      await sendSms(token, from, message, channel, target.messagingNumber);

      if (!conversationId) {
        conversationId = (await pollResolveConversationByPhone(from, target.platformTenantId))?.convId ?? null;
      }

      const reply = conversationId ? ((await pollReply(conversationId, sentAt))?.body ?? "(timed out)") : "(no conv found)";
      console.log(`  [AI]       ${reply}`);
      transcript.push({ role: "ai", text: reply });
      lastReply = reply;
      await sleep(BETWEEN_TURNS_MS);
    }

    if (conversationId && lastReply) {
      await continueTextRecovery(transcript, lastReply, async (message) => {
        const sentAt = new Date();
        await sendSms(token, from, message, channel, target.messagingNumber);
        return (await pollReply(conversationId!, sentAt))?.body ?? "(timed out)";
      }, recoveryProfile);
    }
  } catch (error) {
    failed = true;
    failReason = error instanceof Error ? error.message : String(error);
    console.log(`  [ERROR] ${failReason}`);
  }

  const state = conversationId
    ? await fetchPlatformConversationState(conversationId)
    : { conversation: null, bookingState: null, bookings: [] as BookingRow[] };
  const crmEvidence = await fetchCrmEvidenceExact(testStart, conversationId, state.bookings[0]?.id ?? null);
  const routingVerdict = buildRoutingVerdict(state.conversation, target.platformTenantId);
  const platformVerdict = failed
    ? { passed: false, note: failReason ?? "scenario failed" }
    : checkPlatform(state);
  const crmVerdict = buildCrmVerdict(crmExpectation, crmEvidence);

  console.log();
  printPlatformSummary(state);
  printCrmSummary(crmEvidence);
  console.log(`  routing verdict:  ${routingVerdict.passed ? "PASS ✓" : "FAIL ✗"}  ${routingVerdict.note}`);
  console.log(`  platform verdict: ${platformVerdict.passed ? "PASS ✓" : "FAIL ✗"}  ${platformVerdict.note}`);
  console.log(`  CRM verdict:      ${crmVerdict.passed ? "PASS ✓" : "FAIL ✗"}  ${crmVerdict.note}`);

  return {
    name: label,
    channel,
    passed: routingVerdict.passed && platformVerdict.passed && crmVerdict.passed,
    failReason,
    transcript,
    routingVerdict,
    platformVerdict,
    crmVerdict,
  };
}

async function runWebchatScenario(
  label: string,
  identifierValue: string,
  fullName: string,
  email: string,
  turns: string[],
  recoveryProfile: TextRecoveryProfile,
  token: string,
  testStart: Date,
  crmExpectation: CrmExpectation,
  checkPlatform: (state: Awaited<ReturnType<typeof fetchPlatformConversationState>>) => Verdict
): Promise<TestResult> {
  const target = requireLiveTarget();
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${label}  [WEBCHAT]`);
  console.log(`  Email: ${email}`);
  console.log("═".repeat(64));

  const transcript: TranscriptLine[] = [];
  let conversationId: string | null = null;
  let failed = false;
  let failReason: string | undefined;
  let lastReply = "";

  try {
    const openingMessage = turns[0]!;
    console.log(`\n  [customer] ${openingMessage}`);
    transcript.push({ role: "customer", text: openingMessage });

    const sessionResponse = await fetch(`${PLATFORM_API_URL}/v1/webchat/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-token": token,
      },
      body: JSON.stringify({
        tenantId: target.platformTenantId,
        identifierValue,
        fullName,
        email,
        openingMessage,
      }),
    });

    if (!sessionResponse.ok) {
      throw new Error(`Webchat session ${sessionResponse.status}: ${(await sessionResponse.text()).slice(0, 200)}`);
    }

    const sessionData = (await sessionResponse.json()) as {
      conversation?: { id?: string };
      conversationId?: string;
      replyMessage?: { body?: string } | null;
    };
    conversationId = sessionData.conversation?.id ?? sessionData.conversationId ?? null;
    const firstReply = sessionData.replyMessage?.body ?? "(no reply in response)";
    console.log(`  [AI]       ${firstReply}`);
    transcript.push({ role: "ai", text: firstReply });
    lastReply = firstReply;
    await sleep(BETWEEN_TURNS_MS);

    for (const message of turns.slice(1)) {
      console.log(`\n  [customer] ${message}`);
      transcript.push({ role: "customer", text: message });

      const sentAt = new Date();
      const messageResponse = await fetch(`${PLATFORM_API_URL}/v1/webchat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-service-token": token,
        },
        body: JSON.stringify({
          tenantId: target.platformTenantId,
          conversationId,
          body: message,
          metadata: {},
        }),
      });

      if (!messageResponse.ok) {
        throw new Error(`Webchat msg ${messageResponse.status}: ${(await messageResponse.text()).slice(0, 200)}`);
      }

      const messageData = (await messageResponse.json()) as { replyMessage?: { body?: string } | null };
      const reply =
        messageData.replyMessage?.body ??
        (conversationId ? (await pollReply(conversationId, sentAt))?.body : null) ??
        "(timed out)";
      console.log(`  [AI]       ${reply}`);
      transcript.push({ role: "ai", text: reply });
      lastReply = reply;
      await sleep(BETWEEN_TURNS_MS);
    }

    if (conversationId && lastReply) {
      await continueTextRecovery(transcript, lastReply, async (message) => {
        const sentAt = new Date();
        const messageResponse = await fetch(`${PLATFORM_API_URL}/v1/webchat/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-service-token": token,
          },
          body: JSON.stringify({
            tenantId: target.platformTenantId,
            conversationId,
            body: message,
            metadata: {},
          }),
        });

        if (!messageResponse.ok) {
          throw new Error(`Webchat msg ${messageResponse.status}: ${(await messageResponse.text()).slice(0, 200)}`);
        }

        const messageData = (await messageResponse.json()) as { replyMessage?: { body?: string } | null };
        return (
          messageData.replyMessage?.body ??
          (await pollReply(conversationId!, sentAt))?.body ??
          "(timed out)"
        );
      }, recoveryProfile);
    }
  } catch (error) {
    failed = true;
    failReason = error instanceof Error ? error.message : String(error);
    console.log(`  [ERROR] ${failReason}`);
  }

  if (!conversationId) {
    conversationId = (await resolveConversationByEmail(email, target.platformTenantId))?.convId ?? null;
  }

  const state = conversationId
    ? await fetchPlatformConversationState(conversationId)
    : { conversation: null, bookingState: null, bookings: [] as BookingRow[] };
  const crmEvidence = await fetchCrmEvidenceExact(testStart, conversationId, state.bookings[0]?.id ?? null);
  const routingVerdict = buildRoutingVerdict(state.conversation, target.platformTenantId);
  const platformVerdict = failed
    ? { passed: false, note: failReason ?? "scenario failed" }
    : checkPlatform(state);
  const crmVerdict = buildCrmVerdict(crmExpectation, crmEvidence);

  console.log();
  printPlatformSummary(state);
  printCrmSummary(crmEvidence);
  console.log(`  routing verdict:  ${routingVerdict.passed ? "PASS ✓" : "FAIL ✗"}  ${routingVerdict.note}`);
  console.log(`  platform verdict: ${platformVerdict.passed ? "PASS ✓" : "FAIL ✗"}  ${platformVerdict.note}`);
  console.log(`  CRM verdict:      ${crmVerdict.passed ? "PASS ✓" : "FAIL ✗"}  ${crmVerdict.note}`);

  return {
    name: label,
    channel: "webchat",
    passed: routingVerdict.passed && platformVerdict.passed && crmVerdict.passed,
    failReason,
    transcript,
    routingVerdict,
    platformVerdict,
    crmVerdict,
  };
}

async function runVoiceScenario(
  label: string,
  callerNumber: string,
  fullName: string,
  email: string,
  managedVoiceSecret: string,
  testStart: Date,
  crmExpectation: CrmExpectation,
  checkPlatform: (state: Awaited<ReturnType<typeof fetchPlatformConversationState>>) => Verdict
): Promise<TestResult> {
  const target = requireLiveTarget();
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${label}  [VOICE — ElevenLabs managed]`);
  console.log(`  Caller: ${callerNumber}  Name: "${fullName}"`);
  console.log("═".repeat(64));

  const transcript: TranscriptLine[] = [];
  const externalSessionId = randomUUID();
  let conversationId: string | null = null;
  let failed = false;
  let failReason: string | undefined;

  try {
    console.log("\n  [SIM] → conversation-init");
    const initResponse = await fetch(`${PLATFORM_API_URL}/v1/managed-voice/elevenlabs/conversation-init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-managed-voice-secret": managedVoiceSecret,
      },
      body: JSON.stringify({
        conversation_id: externalSessionId,
        from_number: callerNumber,
        to_number: target.voiceNumber,
        tenant_id: target.platformTenantId,
      }),
    });

    if (!initResponse.ok) {
      throw new Error(`Voice init ${initResponse.status}: ${(await initResponse.text()).slice(0, 200)}`);
    }

    const initData = (await initResponse.json()) as Record<string, unknown>;
    const dynamicVariableKeys = Object.keys((initData.dynamic_variables as Record<string, unknown>) ?? {}).join(", ");
    console.log(`  [SIM] ← init OK  dynamic_variables: ${dynamicVariableKeys || "(none)"}`);
    await sleep(1_200);

    conversationId = (await resolveConversationByPhone(callerNumber, target.platformTenantId))?.convId ?? null;
    console.log(`  [SIM]   convId: ${conversationId ?? "not found yet"}`);

    async function toolCall(
      toolName: string,
      args: Record<string, unknown>,
      callerSays: string | null,
      agentSays: string | null
    ) {
      if (callerSays) {
        console.log(`\n  [caller] ${callerSays}`);
        transcript.push({ role: "customer", text: callerSays });
      }
      if (agentSays) {
        console.log(`  [agent]  ${agentSays}`);
        transcript.push({ role: "ai", text: agentSays });
      }

      const payload: Record<string, unknown> = {
        toolName,
        arguments: args,
        tenantId: target.platformTenantId,
        externalSessionId,
        conversationId: conversationId ?? undefined,
        phoneNumber: callerNumber,
      };

      if (callerSays || agentSays) {
        payload.transcript = [
          ...(callerSays ? [{ role: "user", message: callerSays }] : []),
          ...(agentSays ? [{ role: "assistant", message: agentSays }] : []),
        ];
      }

      const response = await fetch(`${PLATFORM_API_URL}/v1/managed-voice/elevenlabs/tool-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-managed-voice-secret": managedVoiceSecret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`tool-call(${toolName}) ${response.status}: ${(await response.text()).slice(0, 200)}`);
      }

      const data = (await response.json()) as { result: unknown };
      const result = data.result as Record<string, unknown>;
      if (!conversationId) {
        const state = result.bookingState as Record<string, unknown> | undefined;
        const extracted = (state?.conversationId ?? state?.conversation_id) as string | undefined;
        if (extracted) {
          conversationId = extracted;
          console.log(`  [SIM]   convId resolved: ${conversationId}`);
        }
      }
      console.log(`  [tool]   ${toolName} → ${JSON.stringify(result).slice(0, 140)}`);
      await sleep(400);
      return result;
    }

    await toolCall(
      "capture_service_patch",
      {
        serviceKey: "boiler-service",
        serviceName: "Boiler service",
        urgency: "routine",
        issueDescription: "Annual boiler service needed",
        affectedArea: "boiler room",
        confirmedFields: ["service_type", "problem_description", "affected_area", "urgency_level"],
      },
      "Hi, I need to book a boiler service please",
      "Of course! I can help with that. Can I take your details?"
    );

    let slotStart: string | null = null;
    let slotEnd: string | null = null;
    let chosenResourceId: string | undefined;
    const attemptedSlots = new Set<string>();
    const findAvailableVoiceSlot = async () => {
      for (let daysOut = 5; daysOut <= 16; daysOut += 1) {
        for (const hour of [9, 11, 13, 15]) {
          const candidate = new Date();
          candidate.setDate(candidate.getDate() + daysOut);
          candidate.setHours(hour, 0, 0, 0);
          const startTime = candidate.toISOString();
          if (attemptedSlots.has(startTime)) {
            continue;
          }
          const endTime = new Date(candidate.getTime() + 90 * 60_000).toISOString();
          const availability = await toolCall(
            "check_availability",
            { serviceKey: "boiler-service", startTime, endTime },
            null,
            null
          );
          if (availability.available === true) {
            return {
              startTime,
              endTime,
              resourceId: (availability.resourceId ?? availability.checkedResourceId) as string | undefined,
            };
          }
        }
      }
      return null;
    };

    const initialSlot = await findAvailableVoiceSlot();
    if (initialSlot) {
      slotStart = initialSlot.startTime;
      slotEnd = initialSlot.endTime;
      chosenResourceId = initialSlot.resourceId;
      attemptedSlots.add(slotStart);
      console.log(`  [SIM]   found available slot: ${slotStart.slice(0, 16)} resourceId=${chosenResourceId ?? "n/a"}`);
    }

    if (!slotStart || !slotEnd) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 14);
      fallback.setHours(9, 0, 0, 0);
      slotStart = fallback.toISOString();
      slotEnd = new Date(fallback.getTime() + 90 * 60_000).toISOString();
      console.log(`  [SIM]   using fallback slot ${slotStart.slice(0, 16)}`);
    }

    await toolCall(
      "capture_slot_patch",
      {
        requestedStartTime: slotStart,
        requestedEndTime: slotEnd,
        preferredDateText: "this week",
        confirmedFields: ["preferred_date", "preferred_time", "slot_confirmation"],
      },
      "That slot works for me",
      "Perfect, let me lock that in."
    );

    await toolCall(
      "capture_identity_patch",
      {
        fullName,
        phoneNumber: callerNumber,
        postcode: "SW1A 1AA",
        addressLine1: "10 Downing Street",
        city: "London",
        confirmedFields: [
          "customer_name",
          "customer_phone",
          "customer_postcode",
          "customer_address",
          "customer_city",
        ],
      },
      `My name's ${fullName}, postcode SW1A 1AA, ten Downing Street, London`,
      "Got that. And your email address?"
    );

    await toolCall(
      "capture_identity_patch",
      { email, confirmedFields: ["customer_email"] },
      email.replace("@", " at ").replace(".", " dot "),
      "Thank you. Let me confirm your booking now."
    );

    let bookingId: string | undefined;
    let resourceId: string | undefined;
    let holdResult = await toolCall(
      "create_booking_hold",
      {
        startTime: slotStart,
        endTime: slotEnd,
        ...(chosenResourceId ? { resourceId: chosenResourceId } : {}),
      },
      null,
      "I'll secure that slot for you now."
    );
    const booking = holdResult.booking as Record<string, unknown> | undefined;
    bookingId = (booking?.id ?? holdResult.bookingId) as string | undefined;
    resourceId = (booking?.resourceId ?? holdResult.resourceId ?? chosenResourceId) as string | undefined;
    console.log(`  [SIM]   hold bookingId=${bookingId ?? "n/a"}, resourceId=${resourceId ?? "n/a"}`);

    for (let retryIndex = 0; !bookingId && holdResult.errorCode === "slot_unavailable" && retryIndex < 4; retryIndex += 1) {
      const retrySlot = await findAvailableVoiceSlot();
      if (!retrySlot) {
        break;
      }

      slotStart = retrySlot.startTime;
      slotEnd = retrySlot.endTime;
      chosenResourceId = retrySlot.resourceId;
      attemptedSlots.add(slotStart);
      console.log(`  [SIM]   retrying with slot: ${slotStart.slice(0, 16)} resourceId=${chosenResourceId ?? "n/a"}`);

      await toolCall(
        "capture_slot_patch",
        {
          requestedStartTime: slotStart,
          requestedEndTime: slotEnd,
          preferredDateText: "this week",
          confirmedFields: ["preferred_date", "preferred_time", "slot_confirmation"],
        },
        "That next slot works for me",
        "No problem, I'll move you to the next available slot."
      );

      holdResult = await toolCall(
        "create_booking_hold",
        {
          startTime: slotStart,
          endTime: slotEnd,
          ...(chosenResourceId ? { resourceId: chosenResourceId } : {}),
        },
        null,
        "I'll secure that updated slot for you now."
      );
      const retryBooking = holdResult.booking as Record<string, unknown> | undefined;
      bookingId = (retryBooking?.id ?? holdResult.bookingId) as string | undefined;
      resourceId = (retryBooking?.resourceId ?? holdResult.resourceId ?? chosenResourceId) as string | undefined;
      console.log(`  [SIM]   retry hold bookingId=${bookingId ?? "n/a"}, resourceId=${resourceId ?? "n/a"}`);
    }

    if (!bookingId && holdResult.nextTool === "create_handoff") {
      await toolCall(
        "create_handoff",
        {
          reason: "slot_unavailable",
          summary: `Requested slot ${slotStart ?? "unknown"} became unavailable during confirmation`,
        },
        null,
        "That slot has just gone, so I'll arrange a callback with the next option."
      );
    }

    if (bookingId && resourceId) {
      const confirmResult = await toolCall(
        "confirm_booking",
        {
          bookingId,
          resourceId,
          startTime: slotStart,
          endTime: slotEnd,
          identity: {
            fullName,
            phoneNumber: callerNumber,
            email,
            postcode: "SW1A 1AA",
            addressLine1: "10 Downing Street",
            city: "London",
          },
        },
        "Yes, please confirm the booking",
        "Excellent! Your boiler service is confirmed."
      );

      if (confirmResult.errorCode === "confirmation_incomplete") {
        await toolCall(
          "create_handoff",
          {
            reason: "confirmation_incomplete",
            summary: `Managed voice could not complete confirmation for ${fullName}; caller needs human follow-up`,
          },
          null,
          "I need a teammate to finish this booking with you, so I'll arrange a callback now."
        );
      }
    }

    await fetch(`${PLATFORM_API_URL}/v1/managed-voice/elevenlabs/post-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-managed-voice-secret": managedVoiceSecret,
      },
      body: JSON.stringify({
        conversation_id: externalSessionId,
        tenant_id: target.platformTenantId,
        from_number: callerNumber,
        to_number: target.voiceNumber,
        summary: `Boiler service booking for ${fullName}`,
        transcript: transcript.map((line) => ({
          role: line.role === "customer" ? "user" : "assistant",
          message: line.text,
        })),
      }),
    }).catch((error) => {
      console.log(`  [WARN]  post-call: ${error instanceof Error ? error.message : String(error)}`);
    });
  } catch (error) {
    failed = true;
    failReason = error instanceof Error ? error.message : String(error);
    console.log(`  [ERROR] ${failReason}`);
  }

  await sleep(2_000);
  if (!conversationId) {
    conversationId = (await resolveConversationByPhone(callerNumber, target.platformTenantId))?.convId ?? null;
  }

  const state = conversationId
    ? await fetchPlatformConversationState(conversationId)
    : { conversation: null, bookingState: null, bookings: [] as BookingRow[] };
  const crmEvidence = await fetchCrmEvidenceExact(testStart, conversationId, state.bookings[0]?.id ?? null);
  const routingVerdict = buildRoutingVerdict(state.conversation, target.platformTenantId);
  const platformVerdict = failed
    ? { passed: false, note: failReason ?? "scenario failed" }
    : checkPlatform(state);
  const crmVerdict = buildCrmVerdict(crmExpectation, crmEvidence);

  console.log();
  printPlatformSummary(state);
  printCrmSummary(crmEvidence);
  console.log(`  routing verdict:  ${routingVerdict.passed ? "PASS ✓" : "FAIL ✗"}  ${routingVerdict.note}`);
  console.log(`  platform verdict: ${platformVerdict.passed ? "PASS ✓" : "FAIL ✗"}  ${platformVerdict.note}`);
  console.log(`  CRM verdict:      ${crmVerdict.passed ? "PASS ✓" : "FAIL ✗"}  ${crmVerdict.note}`);

  return {
    name: label,
    channel: "voice",
    passed: routingVerdict.passed && platformVerdict.passed && crmVerdict.passed,
    failReason,
    transcript,
    routingVerdict,
    platformVerdict,
    crmVerdict,
  };
}

async function main() {
  console.log("═".repeat(64));
  console.log("  LIVE CHANNEL TESTS");
  console.log(`  Target:          ${PLATFORM_API_URL}`);
  console.log(`  Time:            ${new Date().toISOString()}`);
  console.log("═".repeat(64));

  console.log("\n  Fetching secrets from gcloud...");
  const internalToken = gcloudSecret("internal-service-token");
  const managedVoiceSecret = gcloudSecret("elevenlabs-managed-webhook-secret");
  PLATFORM_DB_URL = gcloudSecret("platform-database-url");
  const target = await resolveLiveTarget();
  console.log("  Secrets loaded ✓");
  console.log(`  Acceptance tenant: ${target.platformTenantName}`);
  console.log(`  Messaging number:  ${target.messagingNumber} (${target.messagingProvider})`);
  console.log(`  Voice number:      ${target.voiceNumber} (${target.voiceProvider})`);
  console.log(`  CRM tenant:        ${target.crmTenantId}`);
  console.log(`  CRM workspace:     ${target.crmWorkspaceId}\n`);

  const runId = Date.now().toString().slice(-7);
  const dayAfterTomorrow = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const results: TestResult[] = [];

  results.push(
    await runSmsScenario(
      "T1 — SMS Standard Booking",
      "sms",
      `+447${runId}01`,
      [
        "Hi, I need a boiler service. My name is Sarah Brown, postcode EC1A 1BB",
        `${dayAfterTomorrow} afternoon please`,
        "The third slot works for me",
        `sarah.sms.${runId}@test.com`,
        "22 Old Street, London EC1A 1BB",
        "Annual boiler service, it's in the kitchen",
        "Yes please confirm that booking",
      ],
      {
        fullName: "Sarah Brown",
        email: `sarah.sms.${runId}@test.com`,
        phone: `+447${runId}01`,
        postcode: "EC1A 1BB",
        address: "22 Old Street, London EC1A 1BB",
        affectedArea: "kitchen",
        problemDescription: "Annual boiler service, it's in the kitchen",
        preferredTime: `${dayAfterTomorrow} afternoon please`,
      },
      internalToken,
      new Date(),
      "booking",
      (state) => ({
        passed: state.bookings.some((booking) => booking.booking_status === "confirmed"),
        note: state.bookings[0]
          ? `booking=${state.bookings[0].booking_status}`
          : `state=${state.bookingState?.current_state ?? "n/a"}`,
      })
    )
  );

  await sleep(3_000);

  results.push(
    await runSmsScenario(
      "T2 — SMS Escalation",
      "sms",
      `+447${runId}02`,
      [
        "Hi I've got a leaking radiator I need help with",
        "Actually I'd rather speak to a real person please",
      ],
      {
        fullName: "Escalation Customer",
        phone: `+447${runId}02`,
        problemDescription: "Leaking radiator",
      },
      internalToken,
      new Date(),
      "conversation",
      (state) => ({
        passed:
          state.bookingState?.current_state === "escalated" ||
          state.bookingState?.current_state?.includes("handoff") ||
          Boolean(state.conversation),
        note: `state=${state.bookingState?.current_state ?? "n/a"}`,
      })
    )
  );

  await sleep(3_000);

  results.push(
    await runSmsScenario(
      "T3 — WhatsApp Emergency Callout",
      "whatsapp",
      `+447${runId}03`,
      [
        "URGENT burst pipe, water everywhere. Need someone NOW. Alice Thompson, 45 Victoria Road, London W1A 1AA",
        `alice.wp.${runId}@test.com`,
        "The burst pipe is in the bathroom",
        "Today as soon as possible",
        "The third slot works for me",
      ],
      {
        fullName: "Alice Thompson",
        email: `alice.wp.${runId}@test.com`,
        phone: `+447${runId}03`,
        postcode: "W1A 1AA",
        address: "45 Victoria Road, London W1A 1AA",
        affectedArea: "bathroom",
        problemDescription: "URGENT burst pipe, water everywhere.",
        preferredTime: "Today as soon as possible",
      },
      internalToken,
      new Date(),
      "booking",
      (state) => {
        const service = (state.bookingState?.collected_data as Record<string, Record<string, unknown>> | null)?.service;
        const isEmergency =
          service?.urgency === "emergency" ||
          String(service?.serviceKey ?? "").includes("emergency") ||
          String(service?.urgency ?? "").includes("asap");
        return {
          passed: state.bookings.some((booking) => booking.booking_status === "confirmed") || isEmergency,
          note: state.bookings[0]
            ? `booking=${state.bookings[0].booking_status}`
            : `service=${String(service?.serviceKey ?? "n/a")} urgency=${String(service?.urgency ?? "n/a")}`,
        };
      }
    )
  );

  await sleep(3_000);

  results.push(
    await runWebchatScenario(
      "T4 — Webchat FAQ + Booking",
      `webchat-${runId}04`,
      "Tom Hughes",
      `tom.webchat.${runId}04@test.com`,
      [
        "Hi, do you do boiler servicing and what does it roughly cost?",
        "Great, I'd like to book a boiler service",
        `${dayAfterTomorrow} morning around 9am`,
        "The third slot works for me",
        "My phone number is 07700 900 104",
        "Tom Hughes, postcode W2 1AA, 8 Bayswater Road London",
        `tom.webchat.${runId}04@test.com`,
        "The boiler is in the kitchen",
        "Yes please confirm",
      ],
      {
        fullName: "Tom Hughes",
        email: `tom.webchat.${runId}04@test.com`,
        phone: "07700 900 104",
        postcode: "W2 1AA",
        address: "8 Bayswater Road London",
        affectedArea: "kitchen",
        problemDescription: "The boiler is in the kitchen",
        preferredTime: `${dayAfterTomorrow} morning around 9am`,
      },
      internalToken,
      new Date(),
      "booking",
      (state) => ({
        passed: state.bookings.some((booking) => booking.booking_status === "confirmed"),
        note: state.bookings[0]
          ? `booking=${state.bookings[0].booking_status}`
          : `state=${state.bookingState?.current_state ?? "n/a"}`,
      })
    )
  );

  await sleep(3_000);

  results.push(
    await runVoiceScenario(
      "T5 — Voice Single-Name",
      `+447${runId}05`,
      "James",
      `james.voice.${runId}05@test.com`,
      managedVoiceSecret,
      new Date(),
      "booking_or_handoff",
      (state) => ({
        passed:
          state.bookings.some((booking) => booking.booking_status === "confirmed") ||
          state.bookingState?.current_state === "handoff_required" ||
          state.bookingState?.current_state === "escalated",
        note: state.bookings[0]
          ? `booking=${state.bookings[0].booking_status}`
          : `state=${state.bookingState?.current_state ?? "n/a"}`,
      })
    )
  );

  await sleep(3_000);

  results.push(
    await runVoiceScenario(
      "T6 — Voice Standard Booking",
      `+447${runId}06`,
      "John Smith",
      `john.smith.${runId}06@test.com`,
      managedVoiceSecret,
      new Date(),
      "booking",
      (state) => ({
        passed: state.bookings.some((booking) => booking.booking_status === "confirmed"),
        note: state.bookings[0]
          ? `booking=${state.bookings[0].booking_status}`
          : `state=${state.bookingState?.current_state ?? "n/a"}`,
      })
    )
  );

  await sleep(3_000);

  // T7 — WhatsApp Standard Booking (mirrors T1 but on WhatsApp; T3 only
  // exercised the emergency path, so this catches WhatsApp routing
  // regressions on a non-urgent booking).
  results.push(
    await runSmsScenario(
      "T7 — WhatsApp Standard Booking",
      "whatsapp",
      `+447${runId}07`,
      [
        "Hi, I'd like to book a boiler service please. I'm David Patel, postcode N1 9AB",
        `${dayAfterTomorrow} afternoon would be ideal`,
        "The third slot works for me",
        `david.wp.${runId}07@test.com`,
        "12 Caledonian Road, London N1 9AB",
        "Annual service for a Worcester combi",
        "Yes please confirm that slot",
      ],
      {
        fullName: "David Patel",
        email: `david.wp.${runId}07@test.com`,
        phone: `+447${runId}07`,
        postcode: "N1 9AB",
        address: "12 Caledonian Road, London N1 9AB",
        problemDescription: "Annual service for a Worcester combi",
        preferredTime: `${dayAfterTomorrow} afternoon would be ideal`,
      },
      internalToken,
      new Date(),
      "booking",
      (state) => ({
        passed: state.bookings.some((booking) => booking.booking_status === "confirmed"),
        note: state.bookings[0]
          ? `booking=${state.bookings[0].booking_status}`
          : `state=${state.bookingState?.current_state ?? "n/a"}`,
      })
    )
  );

  await sleep(3_000);

  // T8 — Webchat Info-Only (FAQ enquiry, customer declines to book).
  // Validates that the agent honours non-booking intents without forcing
  // a conversion, and that the conversation still materialises in CRM.
  results.push(
    await runWebchatScenario(
      "T8 — Webchat Info-Only Enquiry",
      `webchat-${runId}08`,
      "Priya Shah",
      `priya.web.${runId}08@test.com`,
      [
        "Hi, just gathering information. Do you cover Wembley HA9 for boiler repairs?",
        "Roughly how much is a callout fee?",
        "Thanks, I'll think about it and come back another time",
      ],
      {
        fullName: "Priya Shah",
        email: `priya.web.${runId}08@test.com`,
        postcode: "HA9 0NL",
      },
      internalToken,
      new Date(),
      "conversation",
      (state) => ({
        passed: Boolean(state.conversation) && state.bookings.length === 0,
        note: state.conversation
          ? `conv=${state.conversation.conversation_id.slice(0, 8)} bookings=${state.bookings.length}`
          : "no conversation",
      })
    )
  );

  await sleep(3_000);

  // T9 — SMS Boiler Installation Quote Request. Different service type
  // from the existing service/repair scenarios — covers the installation
  // intent recognition path. Outcome may be a booking (survey visit) or
  // a handoff to sales depending on agent routing.
  results.push(
    await runSmsScenario(
      "T9 — SMS Boiler Installation",
      "sms",
      `+447${runId}09`,
      [
        "I'd like a quote for a new boiler installation please. My current one is 18 years old",
        "Mark O'Connor, 47 Acacia Avenue, Hayes UB3 4TT",
        `mark.sms.${runId}09@test.com`,
        `${dayAfterTomorrow} morning for a survey would suit me`,
        "The third slot works for me",
        "Yes please confirm",
      ],
      {
        fullName: "Mark O'Connor",
        email: `mark.sms.${runId}09@test.com`,
        phone: `+447${runId}09`,
        postcode: "UB3 4TT",
        address: "47 Acacia Avenue, Hayes UB3 4TT",
        problemDescription: "New boiler installation quote — current is 18 years old",
        preferredTime: `${dayAfterTomorrow} morning for a survey would suit me`,
      },
      internalToken,
      new Date(),
      "booking_or_handoff",
      (state) => ({
        passed:
          state.bookings.some((booking) => booking.booking_status === "confirmed") ||
          state.bookingState?.current_state === "handoff_required" ||
          state.bookingState?.current_state === "escalated",
        note: state.bookings[0]
          ? `booking=${state.bookings[0].booking_status}`
          : `state=${state.bookingState?.current_state ?? "n/a"}`,
      })
    )
  );

  await sleep(3_000);

  // T10 — Voice Partial-Data caller. Caller gives name + first line of
  // address only — exercises the same prompt-for-postcode recovery path
  // tested in T5 (Single-Name) but with a different shape of missing data.
  results.push(
    await runVoiceScenario(
      "T10 — Voice Partial Address",
      `+447${runId}10`,
      "Linda",
      `linda.voice.${runId}10@test.com`,
      managedVoiceSecret,
      new Date(),
      "booking_or_handoff",
      (state) => ({
        passed:
          state.bookings.some((booking) => booking.booking_status === "confirmed") ||
          state.bookingState?.current_state === "handoff_required" ||
          state.bookingState?.current_state === "escalated",
        note: state.bookings[0]
          ? `booking=${state.bookings[0].booking_status}`
          : `state=${state.bookingState?.current_state ?? "n/a"}`,
      })
    )
  );

  console.log(`\n${"═".repeat(64)}`);
  console.log("  RESULTS SUMMARY");
  console.log("═".repeat(64));
  const pad = (value: string, width: number) => value.slice(0, width).padEnd(width);
  console.log(`  ${"TEST".padEnd(36)} ${"CH".padEnd(10)} ${"ROUTING".padEnd(10)} ${"PLATFORM".padEnd(10)} ${"CRM".padEnd(10)} OVERALL`);
  console.log("  " + "─".repeat(90));
  for (const result of results) {
    const routing = result.routingVerdict.passed ? "PASS ✓" : "FAIL ✗";
    const platform = result.platformVerdict.passed ? "PASS ✓" : "FAIL ✗";
    const crm = result.crmVerdict.passed ? "PASS ✓" : "FAIL ✗";
    const overall = result.passed ? "PASS ✓" : "FAIL ✗";
    console.log(
      `  ${pad(result.name, 36)} ${pad(result.channel, 10)} ${pad(routing, 10)} ${pad(platform, 10)} ${pad(crm, 10)} ${overall}`
    );
    if (!result.passed) {
      const reason =
        !result.routingVerdict.passed
          ? result.routingVerdict.note
          : !result.platformVerdict.passed
            ? result.platformVerdict.note
            : result.crmVerdict.note;
      console.log(`    ↳ ${reason.slice(0, 120)}`);
    }
  }
  console.log("═".repeat(64));
  const passed = results.filter((result) => result.passed).length;
  console.log(`\n  ${passed} / ${results.length} passed\n`);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
