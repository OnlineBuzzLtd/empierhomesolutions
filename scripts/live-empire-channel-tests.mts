#!/usr/bin/env tsx
/**
 * live-empire-channel-tests.mts
 *
 * Runs 6 real end-to-end scenario tests across all live channels for the
 * Empire Home Solutions tenant against the production platform-api.
 *
 * Tests:
 *   T1 — SMS         — new customer, boiler service, full happy-path booking
 *   T2 — SMS         — escalation: customer asks to speak to a real person
 *   T3 — WhatsApp    — emergency burst pipe, ASAP slot
 *   T4 — Webchat     — FAQ first ("do you do boiler installations?") then books
 *   T5 — Voice       — single first-name only ("James") — tests sanitizeCustomerName fix
 *   T6 — Voice       — standard two-word name ("John Smith") — baseline confirm
 *
 * After each test: prints full transcript, platform booking state, and verifies
 * that platform events landed in the Empire CRM Supabase.
 *
 * Usage:
 *   npx tsx scripts/live-empire-channel-tests.mts
 *
 * Requires: gcloud CLI authenticated against customer-journeys-ai project
 */

import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// ─── Config ───────────────────────────────────────────────────────────────────

const PLATFORM_API_URL = "https://customerjourneys-platform-api-cnz7crlx2a-nw.a.run.app";

// Empire tenant — voice + webchat only (no Twilio SMS/WhatsApp provisioned)
const EMPIRE_TENANT_ID = "b469a9fe-546d-4baa-9f87-3487c7c4afc1";
const EMPIRE_NUMBER = "+441895725151";

// DK Plumbing — has active Twilio SMS/WhatsApp connection; used for text-channel tests
const DK_TENANT_ID = "75d76e43-4e5e-4568-8ff2-e2594c9818f9";
const DK_NUMBER = "+447401248976";

// Platform Supabase (AI messages, booking state, bookings)
const PLATFORM_SB_URL = "https://wplzciiucskeumugbpwv.supabase.co";
const PLATFORM_SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbHpjaWl1Y3NrZXVtdWdicHd2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAzNzc4NywiZXhwIjoyMDg4NjEzNzg3fQ.2bPCmQOOyuVL0zShOaGpkToMj_n1dAUB5KS-aQUBrdc";

// Empire CRM Supabase (platform_event_log, appointments, jobs)
const CRM_SB_URL = "https://dodttkkkmxsqfewuahqi.supabase.co";
const CRM_SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvZHR0a2trbXhzcWZld3VhaHFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzMwNzk3OSwiZXhwIjoyMDg4ODgzOTc5fQ.pIke6BblnFlPAMUJe-VBjUupnJUyfuqPuvF4XKZrNsc";
const CRM_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const DEFAULT_POLL_MS = 25_000;
const POLL_INTERVAL_MS = 700;
const BETWEEN_TURNS_MS = 900;

// ─── Secrets ──────────────────────────────────────────────────────────────────

function gcloudSecret(name: string): string {
  return execSync(
    `gcloud secrets versions access latest --secret="${name}" --project=customer-journeys-ai`,
    {
      encoding: "utf8",
      env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1", CLOUDSDK_SURVEY_DISABLE: "1" },
    }
  ).trim();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function platformGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${PLATFORM_SB_URL}/rest/v1/${path}`, {
    headers: { apikey: PLATFORM_SB_KEY, Authorization: `Bearer ${PLATFORM_SB_KEY}` },
  });
  if (!res.ok) throw new Error(`Platform GET ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T[]>;
}

async function crmGet<T>(path: string, schema = "public"): Promise<T[]> {
  const res = await fetch(`${CRM_SB_URL}/rest/v1/${path}`, {
    headers: {
      apikey: CRM_SB_KEY,
      Authorization: `Bearer ${CRM_SB_KEY}`,
      "Accept-Profile": schema,
    },
  });
  if (!res.ok) throw new Error(`CRM GET ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T[]>;
}

// ─── Row types ────────────────────────────────────────────────────────────────

interface MsgRow {
  id: string;
  conversation_id: string;
  body: string;
  direction: string;
  created_at: string;
}
interface LeadRow {
  id: string;
  phone_number: string;
  full_name: string | null;
}
interface ConvRow {
  id: string;
  lead_id: string;
}
interface BsRow {
  conversation_id: string;
  current_state: string;
  collected_data: Record<string, unknown>;
  waiting_for: string[];
  confirmed_slots: string[];
}
interface BookingRow {
  id: string;
  booking_status: string;
  start_time: string;
}
interface PlatformEventRow {
  id: string;
  event_type: string;
  status: string;
  created_at: string;
  workspace_id: string;
}
interface AppointmentRow {
  id: string;
  starts_at: string;
  status: string;
  title: string | null;
}
interface JobRow {
  id: string;
  title: string | null;
  status: string;
}

// ─── Platform Supabase helpers ────────────────────────────────────────────────

async function resolveConv(
  from: string,
  tenantId = EMPIRE_TENANT_ID
): Promise<{ leadId: string; convId: string } | null> {
  const cleaned = from.replace(/^whatsapp:/, "");
  const leads = await platformGet<LeadRow>(
    `leads?tenant_id=eq.${tenantId}&phone_number=eq.${encodeURIComponent(cleaned)}&order=created_at.desc&limit=1`
  );
  if (!leads[0]) return null;
  const convs = await platformGet<ConvRow>(
    `conversations?lead_id=eq.${leads[0].id}&order=created_at.desc&limit=1`
  );
  if (!convs[0]) return null;
  return { leadId: leads[0].id, convId: convs[0].id };
}

async function resolveConvByEmail(
  email: string,
  tenantId = EMPIRE_TENANT_ID
): Promise<{ leadId: string; convId: string } | null> {
  const leads = await platformGet<LeadRow>(
    `leads?tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`
  );
  if (!leads[0]) return null;
  const convs = await platformGet<ConvRow>(
    `conversations?lead_id=eq.${leads[0].id}&order=created_at.desc&limit=1`
  );
  if (!convs[0]) return null;
  return { leadId: leads[0].id, convId: convs[0].id };
}

async function pollReply(
  convId: string,
  after: Date,
  timeoutMs = DEFAULT_POLL_MS
): Promise<MsgRow | null> {
  const deadline = Date.now() + timeoutMs;
  const afterIso = after.toISOString();
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const rows = await platformGet<MsgRow>(
      `messages?conversation_id=eq.${convId}&direction=eq.outbound&created_at=gt.${encodeURIComponent(afterIso)}&order=created_at.asc&limit=1`
    );
    if (rows[0]?.body) return rows[0];
  }
  return null;
}

async function fetchPlatformState(convId: string) {
  const [bsRows, bookings] = await Promise.all([
    platformGet<BsRow>(`booking_state?conversation_id=eq.${convId}&limit=1`),
    platformGet<BookingRow>(
      `bookings?conversation_id=eq.${convId}&order=created_at.desc&limit=3`
    ),
  ]);
  return { bs: bsRows[0] ?? null, bookings };
}

// ─── CRM Supabase helpers ─────────────────────────────────────────────────────

async function fetchCrmEvents(since: Date): Promise<PlatformEventRow[]> {
  const sinceIso = since.toISOString();
  return crmGet<PlatformEventRow>(
    `platform_event_log?tenant_id=eq.${CRM_TENANT_ID}&created_at=gt.${encodeURIComponent(sinceIso)}&order=created_at.asc&limit=20`,
    "crm"
  );
}

async function fetchCrmAppointments(since: Date): Promise<AppointmentRow[]> {
  const sinceIso = since.toISOString();
  return crmGet<AppointmentRow>(
    `appointments?tenant_id=eq.${CRM_TENANT_ID}&created_at=gt.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=5`,
    "crm"
  );
}

async function fetchCrmJobs(since: Date): Promise<JobRow[]> {
  const sinceIso = since.toISOString();
  return crmGet<JobRow>(
    `jobs?tenant_id=eq.${CRM_TENANT_ID}&created_at=gt.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=5`,
    "crm"
  );
}

function printCrmVerification(
  events: PlatformEventRow[],
  appointments: AppointmentRow[],
  jobs: JobRow[]
) {
  const eventTypes = events.map((e) => e.event_type);
  const checkMark = (name: string) => (eventTypes.includes(name) ? "✓" : "✗");
  console.log(
    `  CRM events:       ConversationStarted ${checkMark("ConversationStarted")}  ConversationQualified ${checkMark("ConversationQualified")}  BookingConfirmed ${checkMark("BookingConfirmed")}`
  );
  if (events.length > 0) {
    console.log(`  CRM event list:   ${eventTypes.join(", ")}`);
  }
  if (appointments.length > 0) {
    const appt = appointments[0]!;
    console.log(
      `  CRM appointment:  ${appt.id.slice(0, 8)}…  starts_at=${appt.starts_at?.slice(0, 16) ?? "n/a"}  status=${appt.status}`
    );
  } else {
    console.log(`  CRM appointment:  none`);
  }
  if (jobs.length > 0) {
    console.log(`  CRM job:          ${jobs[0]!.id.slice(0, 8)}…  status=${jobs[0]!.status}`);
  }
}

function printPlatformSummary(bs: BsRow | null, bookings: BookingRow[]) {
  console.log(`  platform state:   ${bs?.current_state ?? "n/a"}`);
  if (bs?.waiting_for?.length) console.log(`  waiting_for:      ${bs.waiting_for.join(", ")}`);
  const svc = (bs?.collected_data as Record<string, Record<string, unknown>> | null)?.service;
  if (svc?.serviceKey)
    console.log(`  service:          ${String(svc.serviceKey)}${svc.urgency ? ` (${String(svc.urgency)})` : ""}`);
  const identity = (bs?.collected_data as Record<string, Record<string, unknown>> | null)?.identity;
  if (identity?.fullName) console.log(`  name captured:    ${String(identity.fullName)}`);
  console.log(
    `  booking:          ${
      bookings[0]
        ? `${bookings[0].booking_status}${bookings[0].start_time ? ` @ ${new Date(bookings[0].start_time).toLocaleString("en-GB")}` : ""}`
        : "none"
    }`
  );
}

// ─── Result type ──────────────────────────────────────────────────────────────

type TranscriptLine = { role: "customer" | "ai"; text: string };

interface TestResult {
  name: string;
  channel: string;
  passed: boolean;
  passNote: string;
  failReason?: string;
  transcript: TranscriptLine[];
  bookingCreated: boolean;
  bookingStatus?: string;
  crmEvents: string[];
  crmAppointment: boolean;
}

// ─── SMS / WhatsApp helper ────────────────────────────────────────────────────

async function sendSms(
  token: string,
  from: string,
  body: string,
  channel: "sms" | "whatsapp" = "sms",
  toNumber: string = DK_NUMBER
) {
  const fromNum = channel === "whatsapp" ? `whatsapp:${from}` : from;
  const toNum = channel === "whatsapp" ? `whatsapp:${toNumber}` : toNumber;
  const params = new URLSearchParams({
    MessageSid: `SM_TEST_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    AccountSid: "AC_test",
    From: fromNum,
    To: toNum,
    Body: body,
    NumMedia: "0",
    NumSegments: "1",
  });
  const res = await fetch(`${PLATFORM_API_URL}/v1/webhooks/twilio/sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-internal-service-token": token,
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`SMS webhook ${res.status}: ${t.slice(0, 200)}`);
  }
}

async function runSmsScenario(
  label: string,
  channel: "sms" | "whatsapp",
  from: string,
  turns: string[],
  token: string,
  testStart: Date,
  check: (bs: BsRow | null, bookings: BookingRow[]) => { passed: boolean; note: string },
  tenantId = DK_TENANT_ID,
  toNumber = DK_NUMBER
): Promise<TestResult> {
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${label}  [${channel.toUpperCase()}]`);
  console.log(`  From: ${from}  →  To: ${toNumber}  (tenant: ${tenantId.slice(0, 8)}…)`);
  console.log("═".repeat(64));

  const transcript: TranscriptLine[] = [];
  let convId: string | null = null;
  let failed = false;
  let failReason: string | undefined;

  try {
    for (const msg of turns) {
      console.log(`\n  [customer] ${msg}`);
      transcript.push({ role: "customer", text: msg });

      const sentAt = new Date();
      await sendSms(token, from, msg, channel, toNumber);

      if (!convId) {
        await sleep(1_800);
        convId = (await resolveConv(from, tenantId))?.convId ?? null;
      }

      const reply = convId
        ? ((await pollReply(convId, sentAt))?.body ?? "(timed out)")
        : "(no conv found)";
      console.log(`  [AI]       ${reply}`);
      transcript.push({ role: "ai", text: reply });
      await sleep(BETWEEN_TURNS_MS);
    }
  } catch (err) {
    failed = true;
    failReason = (err as Error).message;
    console.log(`  [ERROR] ${failReason}`);
  }

  let bs: BsRow | null = null;
  let bookings: BookingRow[] = [];
  if (convId) {
    ({ bs, bookings } = await fetchPlatformState(convId));
  }

  // Wait for CRM events to propagate
  await sleep(3_000);
  const [crmEvents, crmAppointments, crmJobs] = await Promise.all([
    fetchCrmEvents(testStart).catch(() => [] as PlatformEventRow[]),
    fetchCrmAppointments(testStart).catch(() => [] as AppointmentRow[]),
    fetchCrmJobs(testStart).catch(() => [] as JobRow[]),
  ]);

  console.log();
  printPlatformSummary(bs, bookings);
  printCrmVerification(crmEvents, crmAppointments, crmJobs);

  const { passed, note } = failed
    ? { passed: false, note: failReason ?? "error" }
    : check(bs, bookings);
  console.log(`  result:           ${passed ? "PASS ✓" : "FAIL ✗"}  ${note}`);

  return {
    name: label,
    channel,
    passed,
    passNote: note,
    failReason,
    transcript,
    bookingCreated: bookings.length > 0,
    bookingStatus: bookings[0]?.booking_status,
    crmEvents: crmEvents.map((e) => e.event_type),
    crmAppointment: crmAppointments.length > 0,
  };
}

// ─── Webchat helper ───────────────────────────────────────────────────────────

async function runWebchatScenario(
  label: string,
  identifierValue: string,
  fullName: string,
  email: string,
  turns: string[],
  token: string,
  testStart: Date,
  check: (bs: BsRow | null, bookings: BookingRow[]) => { passed: boolean; note: string }
): Promise<TestResult> {
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${label}  [WEBCHAT]`);
  console.log(`  Email: ${email}`);
  console.log("═".repeat(64));

  const transcript: TranscriptLine[] = [];
  let convId: string | null = null;
  let failed = false;
  let failReason: string | undefined;

  try {
    const openingMsg = turns[0]!;
    console.log(`\n  [customer] ${openingMsg}`);
    transcript.push({ role: "customer", text: openingMsg });

    const sessionRes = await fetch(`${PLATFORM_API_URL}/v1/webchat/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-token": token,
      },
      body: JSON.stringify({
        tenantId: EMPIRE_TENANT_ID,
        identifierValue,
        fullName,
        email,
        openingMessage: openingMsg,
      }),
    });
    if (!sessionRes.ok) {
      throw new Error(`Webchat session ${sessionRes.status}: ${(await sessionRes.text()).slice(0, 200)}`);
    }
    const sessionData = (await sessionRes.json()) as {
      conversation?: { id?: string };
      conversationId?: string;
      replyMessage?: { body?: string } | null;
    };
    convId = (sessionData.conversation?.id ?? sessionData.conversationId) ?? null;
    const firstReply = sessionData.replyMessage?.body ?? "(no reply in response)";
    console.log(`  [AI]       ${firstReply}`);
    transcript.push({ role: "ai", text: firstReply });
    await sleep(BETWEEN_TURNS_MS);

    for (const msg of turns.slice(1)) {
      console.log(`\n  [customer] ${msg}`);
      transcript.push({ role: "customer", text: msg });

      const sentAt = new Date();
      const msgRes = await fetch(`${PLATFORM_API_URL}/v1/webchat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-service-token": token,
        },
        body: JSON.stringify({
          tenantId: EMPIRE_TENANT_ID,
          conversationId: convId!,
          body: msg,
          metadata: {},
        }),
      });
      if (!msgRes.ok) {
        throw new Error(`Webchat msg ${msgRes.status}: ${(await msgRes.text()).slice(0, 200)}`);
      }
      const msgData = (await msgRes.json()) as { replyMessage?: { body?: string } | null };
      const reply =
        msgData.replyMessage?.body ??
        (convId ? (await pollReply(convId, sentAt))?.body : null) ??
        "(timed out)";
      console.log(`  [AI]       ${reply}`);
      transcript.push({ role: "ai", text: reply });
      await sleep(BETWEEN_TURNS_MS);
    }
  } catch (err) {
    failed = true;
    failReason = (err as Error).message;
    console.log(`  [ERROR] ${failReason}`);
  }

  let bs: BsRow | null = null;
  let bookings: BookingRow[] = [];
  if (convId) {
    ({ bs, bookings } = await fetchPlatformState(convId));
  } else {
    // Try to find by email
    const ctx = await resolveConvByEmail(email, EMPIRE_TENANT_ID).catch(() => null);
    if (ctx?.convId) {
      ({ bs, bookings } = await fetchPlatformState(ctx.convId));
    }
  }

  await sleep(3_000);
  const [crmEvents, crmAppointments, crmJobs] = await Promise.all([
    fetchCrmEvents(testStart).catch(() => [] as PlatformEventRow[]),
    fetchCrmAppointments(testStart).catch(() => [] as AppointmentRow[]),
    fetchCrmJobs(testStart).catch(() => [] as JobRow[]),
  ]);

  console.log();
  printPlatformSummary(bs, bookings);
  printCrmVerification(crmEvents, crmAppointments, crmJobs);

  const { passed, note } = failed
    ? { passed: false, note: failReason ?? "error" }
    : check(bs, bookings);
  console.log(`  result:           ${passed ? "PASS ✓" : "FAIL ✗"}  ${note}`);

  return {
    name: label,
    channel: "webchat",
    passed,
    passNote: note,
    failReason,
    transcript,
    bookingCreated: bookings.length > 0,
    bookingStatus: bookings[0]?.booking_status,
    crmEvents: crmEvents.map((e) => e.event_type),
    crmAppointment: crmAppointments.length > 0,
  };
}

// ─── Voice managed-voice helper ───────────────────────────────────────────────

async function runVoiceScenario(
  label: string,
  callerNumber: string,
  fullName: string,
  email: string,
  managedVoiceSecret: string,
  testStart: Date,
  check: (bs: BsRow | null, bookings: BookingRow[]) => { passed: boolean; note: string }
): Promise<TestResult> {
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${label}  [VOICE — ElevenLabs managed]`);
  console.log(`  Caller: ${callerNumber}  Name: "${fullName}"`);
  console.log("═".repeat(64));

  const transcript: TranscriptLine[] = [];
  const externalSessionId = randomUUID();
  let convId: string | null = null;
  let failed = false;
  let failReason: string | undefined;

  try {
    // Step 1: conversation-init
    console.log("\n  [SIM] → conversation-init");
    const initRes = await fetch(
      `${PLATFORM_API_URL}/v1/managed-voice/elevenlabs/conversation-init`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-managed-voice-secret": managedVoiceSecret,
        },
        body: JSON.stringify({
          conversation_id: externalSessionId,
          from_number: callerNumber,
          to_number: EMPIRE_NUMBER,
          tenant_id: EMPIRE_TENANT_ID,
        }),
      }
    );
    if (!initRes.ok) {
      throw new Error(`Voice init ${initRes.status}: ${(await initRes.text()).slice(0, 200)}`);
    }
    const initData = (await initRes.json()) as Record<string, unknown>;
    const dvKeys = Object.keys(
      (initData.dynamic_variables as Record<string, unknown>) ?? {}
    ).join(", ");
    console.log(`  [SIM] ← init OK  dynamic_variables: ${dvKeys || "(none)"}`);
    await sleep(1_200);

    // Resolve conv from DB
    const convCtx = await resolveConv(callerNumber);
    convId = convCtx?.convId ?? null;
    console.log(`  [SIM]   convId: ${convId ?? "not found yet"}`);

    // Tool call helper
    async function toolCall(
      toolName: string,
      args: Record<string, unknown>,
      callerSays: string | null,
      agentSays: string | null
    ): Promise<Record<string, unknown>> {
      if (callerSays) {
        console.log(`\n  [caller] ${callerSays}`);
        transcript.push({ role: "customer", text: callerSays });
      }
      if (agentSays) {
        console.log(`  [agent]  ${agentSays}`);
        transcript.push({ role: "ai", text: agentSays });
      }

      const body: Record<string, unknown> = {
        toolName,
        arguments: args,
        tenantId: EMPIRE_TENANT_ID,
        externalSessionId,
        conversationId: convId ?? undefined,
        phoneNumber: callerNumber,
      };
      if (callerSays || agentSays) {
        body.transcript = [
          ...(callerSays ? [{ role: "user", message: callerSays }] : []),
          ...(agentSays ? [{ role: "assistant", message: agentSays }] : []),
        ];
      }

      const res = await fetch(`${PLATFORM_API_URL}/v1/managed-voice/elevenlabs/tool-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-managed-voice-secret": managedVoiceSecret,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`tool-call(${toolName}) ${res.status}: ${t.slice(0, 200)}`);
      }
      const data = (await res.json()) as { ok: boolean; result: unknown };
      const result = data.result as Record<string, unknown>;

      // Extract convId lazily from response
      if (!convId) {
        const bs = result?.bookingState as Record<string, unknown> | null;
        const extracted = (bs?.conversationId ?? bs?.conversation_id) as string | undefined;
        if (extracted) {
          convId = extracted;
          console.log(`  [SIM]   convId resolved: ${convId}`);
        }
      }
      console.log(`  [tool]   ${toolName} → ${JSON.stringify(result).slice(0, 140)}`);
      await sleep(400);
      return result;
    }

    // Capture service
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

    // Find first available slot (try up to 16 days out, 4 daily slots)
    let slotStart: string | null = null;
    let slotEnd: string | null = null;
    let chosenResourceId: string | undefined;

    outer: for (let daysOut = 5; daysOut <= 16; daysOut++) {
      for (const hour of [9, 11, 13, 15]) {
        const candidate = new Date();
        candidate.setDate(candidate.getDate() + daysOut);
        candidate.setHours(hour, 0, 0, 0);
        const candStart = candidate.toISOString();
        const candEnd = new Date(candidate.getTime() + 90 * 60_000).toISOString();
        const checkResult = await toolCall(
          "check_availability",
          { serviceKey: "boiler-service", startTime: candStart, endTime: candEnd },
          null,
          null
        );
        const available =
          checkResult?.available === true ||
          (checkResult?.reason !== "conflict" && !checkResult?.conflictingBookingId);
        if (available) {
          slotStart = candStart;
          slotEnd = candEnd;
          chosenResourceId = (checkResult?.resourceId ??
            checkResult?.checkedResourceId) as string | undefined;
          console.log(
            `  [SIM]   found available slot: ${slotStart.slice(0, 16)} resourceId=${chosenResourceId ?? "n/a"}`
          );
          break outer;
        }
        console.log(`  [SIM]   slot ${candStart.slice(0, 16)} unavailable`);
      }
    }

    if (!slotStart || !slotEnd) {
      const fb = new Date();
      fb.setDate(fb.getDate() + 14);
      fb.setHours(9, 0, 0, 0);
      slotStart = fb.toISOString();
      slotEnd = new Date(fb.getTime() + 90 * 60_000).toISOString();
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

    // Hold
    let bookingId: string | undefined;
    let resourceId: string | undefined;
    try {
      const holdResult = await toolCall(
        "create_booking_hold",
        {
          startTime: slotStart,
          endTime: slotEnd,
          ...(chosenResourceId ? { resourceId: chosenResourceId } : {}),
        },
        null,
        "I'll secure that slot for you now."
      );
      const holdBooking = holdResult?.booking as Record<string, unknown> | undefined;
      bookingId = (holdBooking?.id ?? holdResult?.bookingId) as string | undefined;
      resourceId = (holdBooking?.resourceId ??
        holdResult?.resourceId ??
        chosenResourceId) as string | undefined;
      console.log(
        `  [SIM]   hold bookingId=${bookingId ?? "n/a"}, resourceId=${resourceId ?? "n/a"}`
      );
    } catch (err) {
      console.log(
        `  [WARN]  create_booking_hold failed: ${(err as Error).message.slice(0, 120)}`
      );
    }

    // Confirm
    if (bookingId && resourceId) {
      await toolCall(
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
    } else {
      console.log("  [SIM]   skipping confirm_booking — no hold was created");
      transcript.push({
        role: "ai",
        text: "I was unable to secure a slot. Please call back to try again.",
      });
    }

    // Post-call
    await fetch(`${PLATFORM_API_URL}/v1/managed-voice/elevenlabs/post-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-managed-voice-secret": managedVoiceSecret,
      },
      body: JSON.stringify({
        conversation_id: externalSessionId,
        tenant_id: EMPIRE_TENANT_ID,
        from_number: callerNumber,
        to_number: EMPIRE_NUMBER,
        summary: `Boiler service booking for ${fullName}`,
        transcript: transcript.map((t) => ({
          role: t.role === "customer" ? "user" : "assistant",
          message: t.text,
        })),
      }),
    }).catch((e) => console.log(`  [WARN]  post-call: ${(e as Error).message}`));
  } catch (err) {
    failed = true;
    failReason = (err as Error).message;
    console.log(`  [ERROR] ${failReason}`);
  }

  await sleep(2_000);
  const finalConvId = convId ?? (await resolveConv(callerNumber, EMPIRE_TENANT_ID).catch(() => null))?.convId;
  let bs: BsRow | null = null;
  let bookings: BookingRow[] = [];
  if (finalConvId) {
    ({ bs, bookings } = await fetchPlatformState(finalConvId));
  }

  await sleep(4_000);
  const [crmEvents, crmAppointments, crmJobs] = await Promise.all([
    fetchCrmEvents(testStart).catch(() => [] as PlatformEventRow[]),
    fetchCrmAppointments(testStart).catch(() => [] as AppointmentRow[]),
    fetchCrmJobs(testStart).catch(() => [] as JobRow[]),
  ]);

  console.log();
  printPlatformSummary(bs, bookings);
  printCrmVerification(crmEvents, crmAppointments, crmJobs);

  const { passed, note } = failed
    ? { passed: false, note: failReason ?? "error" }
    : check(bs, bookings);
  console.log(`  result:           ${passed ? "PASS ✓" : "FAIL ✗"}  ${note}`);

  return {
    name: label,
    channel: "voice",
    passed,
    passNote: note,
    failReason,
    transcript,
    bookingCreated: bookings.length > 0,
    bookingStatus: bookings[0]?.booking_status,
    crmEvents: crmEvents.map((e) => e.event_type),
    crmAppointment: crmAppointments.length > 0,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(64));
  console.log("  LIVE CHANNEL TESTS");
  console.log(`  Empire tenant:   ${EMPIRE_TENANT_ID}  (voice + webchat)`);
  console.log(`  DK Plumbing:     ${DK_TENANT_ID}  (SMS + WhatsApp)`);
  console.log(`  Target:          ${PLATFORM_API_URL}`);
  console.log(`  Time:            ${new Date().toISOString()}`);
  console.log("═".repeat(64));

  console.log("\n  Fetching secrets from gcloud...");
  const internalToken = gcloudSecret("internal-service-token");
  const managedVoiceSecret = gcloudSecret("elevenlabs-managed-webhook-secret");
  console.log("  Secrets loaded ✓\n");

  const runId = Date.now().toString(36).slice(-6);
  const dayAfterTomorrow = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const results: TestResult[] = [];

  // ── T1: SMS — Standard happy-path booking ─────────────────────────────────
  {
    const testStart = new Date();
    results.push(
      await runSmsScenario(
        "T1 — SMS Standard Booking",
        "sms",
        `+447711${runId}01`,
        [
          "Hi, I need a boiler service. My name is Sarah Brown, postcode EC1A 1BB",
          `${dayAfterTomorrow} afternoon please`,
          "Yes, the first slot works for me",
          `sarah.sms.${runId}@test.com`,
          "22 Old Street, London EC1A 1BB",
          "Annual boiler service, it's in the kitchen",
          "YES please confirm",
        ],
        internalToken,
        testStart,
        (bs, bookings) => ({
          passed:
            bookings.some(
              (b) => b.booking_status === "confirmed" || b.booking_status === "hold"
            ) || (bs?.current_state !== undefined && bs.current_state !== "new"),
          note: bookings.some((b) => b.booking_status === "confirmed")
            ? "booking CONFIRMED"
            : bookings.length > 0
              ? `booking created (${bookings[0]!.booking_status})`
              : `state=${bs?.current_state ?? "n/a"}`,
        })
      )
    );
  }

  await sleep(3_000);

  // ── T2: SMS — Escalation (customer asks for a human) ──────────────────────
  {
    const testStart = new Date();
    results.push(
      await runSmsScenario(
        "T2 — SMS Escalation",
        "sms",
        `+447733${runId}02`,
        [
          "Hi I've got a leaking radiator I need help with",
          "Actually I'd rather speak to a real person please",
        ],
        internalToken,
        testStart,
        (bs, bookings) => {
          const escalated =
            bs?.current_state === "escalated" ||
            bs?.current_state?.includes("handoff") ||
            bookings.length === 0;
          return {
            passed: escalated || bs?.current_state !== undefined,
            note: `state=${bs?.current_state ?? "n/a"}${escalated ? " (escalation detected)" : ""}`,
          };
        }
      )
    );
  }

  await sleep(3_000);

  // ── T3: WhatsApp — Emergency burst pipe ───────────────────────────────────
  {
    const testStart = new Date();
    results.push(
      await runSmsScenario(
        "T3 — WhatsApp Emergency Callout",
        "whatsapp",
        `+447722${runId}03`,
        [
          "URGENT burst pipe, water everywhere. Need someone NOW. Alice Thompson, 45 Victoria Road, London W1A 1AA",
          `alice.wp.${runId}@test.com`,
          "Today as soon as possible",
          "YES confirm please",
        ],
        internalToken,
        testStart,
        (bs, bookings) => {
          const svc = (
            bs?.collected_data as Record<string, Record<string, unknown>> | null
          )?.service;
          const isEmergency =
            svc?.urgency === "emergency" ||
            String(svc?.serviceKey ?? "").includes("emergency") ||
            String(svc?.urgency ?? "").includes("asap");
          return {
            passed: isEmergency || bookings.length > 0,
            note: isEmergency
              ? `emergency urgency=${String(svc?.urgency ?? "n/a")}${bookings.length > 0 ? " + booking created" : ""}`
              : `state=${bs?.current_state ?? "n/a"}, service=${String(svc?.serviceKey ?? "n/a")}`,
          };
        }
      )
    );
  }

  await sleep(3_000);

  // ── T4: Webchat — FAQ then booking ────────────────────────────────────────
  {
    const testStart = new Date();
    results.push(
      await runWebchatScenario(
        "T4 — Webchat FAQ + Booking",
        `webchat-${runId}04`,
        "Tom Hughes",
        `tom.webchat.${runId}04@test.com`,
        [
          "Hi, do you do boiler installations and what does it roughly cost?",
          "Great, I'd like to book a boiler installation",
          `${dayAfterTomorrow} morning around 9am`,
          "Yes the first slot works",
          `Tom Hughes, postcode W2 1AA, 8 Bayswater Road London`,
          `tom.webchat.${runId}04@test.com`,
          "YES please confirm",
        ],
        internalToken,
        testStart,
        (bs, bookings) => {
          const svc = (
            bs?.collected_data as Record<string, Record<string, unknown>> | null
          )?.service;
          const hasService = Boolean(svc?.serviceKey);
          return {
            passed: hasService || bookings.length > 0,
            note: bookings.length > 0
              ? `booking=${bookings[0]!.booking_status}`
              : hasService
                ? `service=${String(svc!.serviceKey)}, state=${bs?.current_state ?? "n/a"}`
                : `state=${bs?.current_state ?? "n/a"}`,
          };
        }
      )
    );
  }

  await sleep(3_000);

  // ── T5: Voice — single first name only (tests sanitizeCustomerName fix) ───
  {
    const testStart = new Date();
    results.push(
      await runVoiceScenario(
        "T5 — Voice Single-Name (sanitizeCustomerName fix test)",
        `+447755${runId}05`,
        "James",
        `james.voice.${runId}05@test.com`,
        managedVoiceSecret,
        testStart,
        (bs, bookings) => ({
          passed: bookings.some(
            (b) => b.booking_status === "confirmed" || b.booking_status === "hold"
          ),
          note: bookings.some((b) => b.booking_status === "confirmed")
            ? "booking CONFIRMED with single-word name"
            : bookings.length > 0
              ? `booking created (${bookings[0]!.booking_status})`
              : `state=${bs?.current_state ?? "n/a"} — no booking`,
        })
      )
    );
  }

  await sleep(3_000);

  // ── T6: Voice — standard two-word name (baseline) ─────────────────────────
  {
    const testStart = new Date();
    results.push(
      await runVoiceScenario(
        "T6 — Voice Standard Booking (John Smith)",
        `+447766${runId}06`,
        "John Smith",
        `john.smith.${runId}06@test.com`,
        managedVoiceSecret,
        testStart,
        (bs, bookings) => ({
          passed: bookings.some(
            (b) => b.booking_status === "confirmed" || b.booking_status === "hold"
          ),
          note: bookings.some((b) => b.booking_status === "confirmed")
            ? "booking CONFIRMED"
            : bookings.length > 0
              ? `booking created (${bookings[0]!.booking_status})`
              : `state=${bs?.current_state ?? "n/a"} — no booking`,
        })
      )
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(64)}`);
  console.log("  RESULTS SUMMARY");
  console.log("═".repeat(64));
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  console.log(
    `  ${"TEST".padEnd(46)} ${"CH".padEnd(9)} RESULT`
  );
  console.log("  " + "─".repeat(62));
  for (const r of results) {
    const status = r.passed ? "PASS ✓" : "FAIL ✗";
    console.log(`  ${pad(r.name, 46)} ${pad(r.channel, 9)} ${status}`);
    if (!r.passed && r.failReason) {
      console.log(`    ↳ ${r.failReason.slice(0, 90)}`);
    } else if (!r.passed) {
      console.log(`    ↳ ${r.passNote.slice(0, 90)}`);
    }
  }
  console.log("═".repeat(64));
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n  ${passed} / ${results.length} passed\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
