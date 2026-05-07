/**
 * Real booking-journey integration tests.
 *
 * These tests hit the LIVE Supabase project — no mocks, no fakes.
 * Each test fires platform events through the real processPlatformEvent()
 * pipeline, then queries the database to confirm the expected rows were
 * written (appointments, jobs, leads, conversation links).
 *
 * The entire suite is skipped when SUPABASE_SERVICE_ROLE_KEY is absent so
 * it never breaks CI environments that lack DB credentials.
 *
 * Run with:
 *   npm run test:integration
 *
 * Required env vars (already present in .env.local for normal development):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { processPlatformEvent } from "@/modules/platform/lib/processor";
import type { PlatformEventEnvelope } from "@/modules/platform/contracts";

// ─── Tenant configuration ─────────────────────────────────────────────────────
// The Empire Home Solutions tenant that is seeded by the multitenancy migration.
// workspace_id is resolved dynamically in beforeAll because the real DB
// workspace_id may differ from the tenant_id.
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
let WORKSPACE_ID = "";

// ─── Skip guard ───────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const hasCredentials = Boolean(supabaseUrl && serviceRoleKey);

if (!hasCredentials) {
  console.warn(
    "[integration] Skipping booking-journey tests: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.",
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ConversationLinkRow = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  customer_id: string | null;
  lead_id: string | null;
  job_id: string | null;
  callback_appointment_id: string | null;
  booking_appointment_id: string | null;
  latest_channel: string | null;
};

type CleanupRecord = {
  conversationId: string;
  eventIds: string[];
  appointmentIds: string[];
  jobIds: string[];
  leadIds: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function id() {
  return crypto.randomUUID();
}

function makeEvent(
  type: PlatformEventEnvelope["event_type"],
  conversationId: string,
  payload: Record<string, unknown>,
): PlatformEventEnvelope {
  return {
    event_id: id(),
    event_type: type,
    event_version: 1,
    workspace_id: WORKSPACE_ID,
    occurred_at: new Date().toISOString(),
    source_system: "agentic_runtime",
    idempotency_key: `integration-test:${type}:${conversationId}`,
    correlation_id: null,
    causation_id: null,
    aggregate: { type: "conversation", id: conversationId },
    payload,
  };
}

async function getConversationLink(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationLinkRow | null> {
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_conversation_links")
    .select(
      "id, tenant_id, conversation_id, customer_id, lead_id, job_id, callback_appointment_id, booking_appointment_id, latest_channel",
    )
    .eq("tenant_id", TENANT_ID)
    .eq("conversation_id", conversationId)
    .maybeSingle<ConversationLinkRow>();

  if (error) throw error;
  return data;
}

/**
 * Deletes all rows created by a test in FK-safe order.
 *
 * Delete order:
 *   1. notes (entity_id refs, no FK back)
 *   2. platform_conversation_links (nullifies refs to appointments/jobs/leads)
 *   3. platform_command_log (aggregate_id = conversationId)
 *   4. platform_event_log (event_id IN eventIds)
 *   5. appointments (job_checklists cascade via jobs, not appointments)
 *   6. jobs (job_checklists cascade on delete)
 *   7. leads
 */
async function cleanupTestData(supabase: SupabaseClient, rec: CleanupRecord) {
  const { conversationId, eventIds, appointmentIds, jobIds, leadIds } = rec;

  if (leadIds.length > 0) {
    await supabase
      .schema("crm")
      .from("notes")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .in("entity_id", leadIds);
  }

  await supabase
    .schema("crm")
    .from("platform_conversation_links")
    .delete()
    .eq("tenant_id", TENANT_ID)
    .eq("conversation_id", conversationId);

  await supabase
    .schema("crm")
    .from("platform_command_log")
    .delete()
    .eq("tenant_id", TENANT_ID)
    .eq("aggregate_id", conversationId);

  if (eventIds.length > 0) {
    await supabase
      .schema("crm")
      .from("platform_event_log")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .in("event_id", eventIds);
  }

  if (appointmentIds.length > 0) {
    await supabase.schema("crm").from("appointments").delete().eq("tenant_id", TENANT_ID).in("id", appointmentIds);
  }

  if (jobIds.length > 0) {
    await supabase.schema("crm").from("jobs").delete().eq("tenant_id", TENANT_ID).in("id", jobIds);
  }

  if (leadIds.length > 0) {
    await supabase.schema("crm").from("leads").delete().eq("tenant_id", TENANT_ID).in("id", leadIds);
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

const describeOrSkip = hasCredentials ? describe : describe.skip;

describeOrSkip("real booking journeys — live Supabase", () => {
  let supabase: SupabaseClient;
  let pending: CleanupRecord[] = [];

  // A real customer record created once for the booking tests so that
  // MatchCustomerByChannelIdentity can resolve customer_id → enabling the
  // auto-job creation path.
  let testCustomerId = "";
  const TEST_CUSTOMER_PHONE = "+447900099001"; // unique enough to avoid false matches

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Look up the real workspace_id for the tenant (may differ from tenant_id
    // in production vs. seeded local environments).
    const { data: aliasData, error: aliasError } = await supabase
      .schema("crm")
      .from("workspace_aliases")
      .select("workspace_id")
      .eq("tenant_id", TENANT_ID)
      .single<{ workspace_id: string }>();

    if (aliasError || !aliasData) {
      throw new Error(`Could not resolve workspace_id for tenant ${TENANT_ID}: ${aliasError?.message ?? "not found"}`);
    }

    WORKSPACE_ID = aliasData.workspace_id;

    // Seed a test customer that MatchCustomerByChannelIdentity can match.
    const { data: customer, error: customerError } = await supabase
      .schema("crm")
      .from("customers")
      .insert({
        tenant_id: TENANT_ID,
        full_name: "Integration Test Customer",
        phone: TEST_CUSTOMER_PHONE,
        is_demo: false,
      })
      .select("id")
      .single<{ id: string }>();

    if (customerError || !customer) {
      throw new Error(`Could not create test customer: ${customerError?.message ?? "unknown"}`);
    }

    testCustomerId = customer.id;
  });

  afterAll(async () => {
    // Deleting the test customer cascades to any jobs that reference it.
    if (testCustomerId) {
      await supabase.schema("crm").from("customers").delete().eq("id", testCustomerId).eq("tenant_id", TENANT_ID);
    }
  });

  afterEach(async () => {
    for (const rec of pending) {
      await cleanupTestData(supabase, rec);
    }
    pending = [];
  });

  // ─── 1. SMS ─────────────────────────────────────────────────────────────────

  it("SMS: BookingConfirmed creates an appointment and a booked job in the DB", async () => {
    const conversationId = id();
    const eventIds: string[] = [];
    const bookingStartAt = "2026-05-05T09:00:00.000Z"; // Mon 09:00 UTC

    // ConversationStarted — sets up the link + matches the test customer
    const startedEvent = makeEvent("ConversationStarted", conversationId, {
      channel: "sms",
      identity_phone: TEST_CUSTOMER_PHONE,
      message_summary: "[INTEGRATION TEST] Customer needs a boiler service.",
    });
    eventIds.push(startedEvent.event_id);
    await processPlatformEvent(supabase, startedEvent);

    // BookingConfirmed — creates lead + appointment + job
    const bookingEvent = makeEvent("BookingConfirmed", conversationId, {
      channel: "sms",
      booking_start_at: bookingStartAt,
      booking_end_at: "2026-05-05T10:00:00.000Z",
      booking_slot_label: "Mon 09:00-10:00",
      treatmentType: "Boiler Service",
      message_summary: "[INTEGRATION TEST] Boiler service booked.",
    });
    eventIds.push(bookingEvent.event_id);
    await processPlatformEvent(supabase, bookingEvent);

    // ── Collect IDs ─────────────────────────────────────────────────────────
    const link = await getConversationLink(supabase, conversationId);
    expect(link, "conversation link must exist").not.toBeNull();

    const appointmentIds = [link!.booking_appointment_id].filter(Boolean) as string[];
    const jobIds = [link!.job_id].filter(Boolean) as string[];
    const leadIds = [link!.lead_id].filter(Boolean) as string[];
    pending.push({ conversationId, eventIds, appointmentIds, jobIds, leadIds });

    // ── Assertions ──────────────────────────────────────────────────────────
    expect(link!.booking_appointment_id, "booking appointment must be linked").not.toBeNull();
    expect(link!.job_id, "job must be linked").not.toBeNull();
    expect(link!.customer_id).toBe(testCustomerId);
    expect(link!.latest_channel).toBe("sms");

    const { data: appointment } = await supabase
      .schema("crm")
      .from("appointments")
      .select("id, type, title, starts_at, status")
      .eq("id", link!.booking_appointment_id!)
      .single();
    if (!appointment) throw new Error("appointment row missing");

    expect(appointment.type).toBe("booking");
    // Postgres returns timestamptz as "+00:00" suffix; normalise both sides
    expect(new Date(appointment.starts_at).getTime()).toBe(new Date(bookingStartAt).getTime());
    expect(appointment.title).toBe("Booked visit: Boiler Service (Mon 09:00-10:00)");
    expect(appointment.status).toBe("scheduled");

    const { data: job } = await supabase
      .schema("crm")
      .from("jobs")
      .select("id, status, scheduled_date, scheduled_time, assigned_engineer, is_demo, title")
      .eq("id", link!.job_id!)
      .single();
    if (!job) throw new Error("job row missing");

    expect(job.status).toBe("booked");
    expect(job.scheduled_date).toBe("2026-05-05");
    expect(job.scheduled_time).toMatch(/^09:00/); // Postgres TIME comes back as "09:00:00"
    expect(job.assigned_engineer).toBeNull();
    expect(job.is_demo).toBe(false);
    expect(job.title).toBe("Booked visit: Boiler Service (Mon 09:00-10:00)");
  });

  // ─── 2. WhatsApp ──────────────────────────────────────────────────────────

  it("WhatsApp: BookingConfirmed creates correct appointment + job", async () => {
    const conversationId = id();
    const eventIds: string[] = [];
    const bookingStartAt = "2026-05-06T14:00:00.000Z"; // Tue 14:00 UTC

    const startedEvent = makeEvent("ConversationStarted", conversationId, {
      channel: "whatsapp",
      identity_phone: TEST_CUSTOMER_PHONE,
      message_summary: "[INTEGRATION TEST] Emergency callout request via WhatsApp.",
    });
    eventIds.push(startedEvent.event_id);
    await processPlatformEvent(supabase, startedEvent);

    const bookingEvent = makeEvent("BookingConfirmed", conversationId, {
      channel: "whatsapp",
      booking_start_at: bookingStartAt,
      booking_end_at: "2026-05-06T15:00:00.000Z",
      booking_slot_label: "Tue 14:00-15:00",
      treatmentType: "Emergency Callout",
      message_summary: "[INTEGRATION TEST] Emergency callout booked.",
      lead_score: 9,
      lead_band: "A",
    });
    eventIds.push(bookingEvent.event_id);
    await processPlatformEvent(supabase, bookingEvent);

    const link = await getConversationLink(supabase, conversationId);
    expect(link, "conversation link must exist").not.toBeNull();

    const appointmentIds = [link!.booking_appointment_id].filter(Boolean) as string[];
    const jobIds = [link!.job_id].filter(Boolean) as string[];
    const leadIds = [link!.lead_id].filter(Boolean) as string[];
    pending.push({ conversationId, eventIds, appointmentIds, jobIds, leadIds });

    expect(link!.booking_appointment_id).not.toBeNull();
    expect(link!.job_id).not.toBeNull();
    expect(link!.latest_channel).toBe("whatsapp");

    const { data: job } = await supabase
      .schema("crm")
      .from("jobs")
      .select("id, status, scheduled_date, scheduled_time, lead_id, title")
      .eq("id", link!.job_id!)
      .single();
    if (!job) throw new Error("job row missing");

    expect(job.status).toBe("booked");
    expect(job.scheduled_date).toBe("2026-05-06");
    expect(job.scheduled_time).toMatch(/^14:00/);
    expect(job.title).toBe("Booked visit: Emergency Callout (Tue 14:00-15:00)");
    // The job must be linked to the same lead that was created for this conversation
    expect(job.lead_id).toBe(link!.lead_id);
  });

  // ─── 3. Voice — named engineer ────────────────────────────────────────────

  it("Voice: job is auto-assigned to the named booking-resource engineer", async () => {
    const conversationId = id();
    const eventIds: string[] = [];
    const bookingStartAt = "2026-05-07T08:00:00.000Z"; // Wed 08:00 UTC

    const startedEvent = makeEvent("ConversationStarted", conversationId, {
      channel: "voice",
      identity_phone: TEST_CUSTOMER_PHONE,
      message_summary: "[INTEGRATION TEST] Annual boiler service enquiry via voice.",
    });
    eventIds.push(startedEvent.event_id);
    await processPlatformEvent(supabase, startedEvent);

    const bookingEvent = makeEvent("BookingConfirmed", conversationId, {
      booking_start_at: bookingStartAt,
      booking_end_at: "2026-05-07T09:00:00.000Z",
      booking_slot_label: "Wed 08:00-09:00",
      treatmentType: "Annual Boiler Service",
      // The CustomerJourneys runtime sends this when the booking resource
      // corresponds to a named engineer.
      booking_resource_name: "Jack Mason",
    });
    eventIds.push(bookingEvent.event_id);
    await processPlatformEvent(supabase, bookingEvent);

    const link = await getConversationLink(supabase, conversationId);
    expect(link, "conversation link must exist").not.toBeNull();

    const appointmentIds = [link!.booking_appointment_id].filter(Boolean) as string[];
    const jobIds = [link!.job_id].filter(Boolean) as string[];
    const leadIds = [link!.lead_id].filter(Boolean) as string[];
    pending.push({ conversationId, eventIds, appointmentIds, jobIds, leadIds });

    expect(link!.job_id, "job must be linked").not.toBeNull();

    const { data: job } = await supabase
      .schema("crm")
      .from("jobs")
      .select("id, assigned_engineer, scheduled_date, scheduled_time, title")
      .eq("id", link!.job_id!)
      .single();
    if (!job) throw new Error("job row missing");

    // This is the key assertion: the diary fix auto-assigns from the payload
    expect(job.assigned_engineer).toBe("Jack Mason");
    expect(job.scheduled_date).toBe("2026-05-07");
    expect(job.scheduled_time).toMatch(/^08:00/);
    expect(job.title).toBe("Booked visit: Annual Boiler Service (Wed 08:00-09:00)");
  });

  // ─── 4. Webchat — lead qualification, no booking ─────────────────────────

  it("Webchat: ConversationQualified creates a lead but no appointment or job", async () => {
    const conversationId = id();
    const eventIds: string[] = [];

    const startedEvent = makeEvent("ConversationStarted", conversationId, {
      channel: "web_chat",
      identity_email: "integration-test-webchat@example.com",
      message_summary: "[INTEGRATION TEST] Interested in new boiler installation.",
    });
    eventIds.push(startedEvent.event_id);
    await processPlatformEvent(supabase, startedEvent);

    const qualifiedEvent = makeEvent("ConversationQualified", conversationId, {
      channel: "web_chat",
      qualification_status: "qualified",
      message_summary: "[INTEGRATION TEST] Customer qualified for boiler replacement.",
      urgency_level: "routine",
      lead_score: 7,
      lead_band: "B",
    });
    eventIds.push(qualifiedEvent.event_id);
    await processPlatformEvent(supabase, qualifiedEvent);

    const link = await getConversationLink(supabase, conversationId);
    expect(link, "conversation link must exist").not.toBeNull();

    const leadIds = [link!.lead_id].filter(Boolean) as string[];
    pending.push({ conversationId, eventIds, appointmentIds: [], jobIds: [], leadIds });

    // Lead must be created
    expect(link!.lead_id, "lead must be linked").not.toBeNull();

    const { data: lead } = await supabase
      .schema("crm")
      .from("leads")
      .select("id, status, source")
      .eq("id", link!.lead_id!)
      .single();
    if (!lead) throw new Error("lead row missing");

    // qualification_status: "qualified" → buildLeadStatus → "contacted"
    expect(lead.status).toBe("contacted");
    expect(lead.source).toMatch(/web_chat/);

    // No booking = no appointment, no job
    expect(link!.booking_appointment_id).toBeNull();
    expect(link!.job_id).toBeNull();
  });

  // ─── 5. Missed call — callback appointment, no job ───────────────────────

  it("EscalationRaised creates a follow-up appointment and conversation link", async () => {
    const conversationId = id();
    const eventIds: string[] = [];

    const escalationEvent = makeEvent("EscalationRaised", conversationId, {
      channel: "sms",
      identity_phone: "+447700900006",
      customerName: "Escalation Test Customer",
      trigger: "slot_unavailable",
      response_text: "That time has just gone, so a teammate will follow up.",
    });
    eventIds.push(escalationEvent.event_id);
    await processPlatformEvent(supabase, escalationEvent);

    const link = await getConversationLink(supabase, conversationId);
    expect(link, "conversation link must exist").not.toBeNull();

    const appointmentIds = [link!.callback_appointment_id].filter(Boolean) as string[];
    const leadIds = [link!.lead_id].filter(Boolean) as string[];
    pending.push({ conversationId, eventIds, appointmentIds, jobIds: [], leadIds });

    expect(link!.lead_id, "lead must be linked").not.toBeNull();
    expect(link!.callback_appointment_id, "callback appointment must be linked").not.toBeNull();
    expect(link!.booking_appointment_id).toBeNull();

    const { data: appointment } = await supabase
      .schema("crm")
      .from("appointments")
      .select("id, type, title, status")
      .eq("id", link!.callback_appointment_id!)
      .single();
    if (!appointment) throw new Error("appointment row missing");

    expect(appointment.type).toBe("follow_up");
    expect(appointment.title).toBe("AI escalation follow-up");
    expect(appointment.status).toBe("scheduled");
  });

  it("Missed-call: MissedCallCaptured creates a callback appointment but no job", async () => {
    const conversationId = id();
    const eventIds: string[] = [];

    const missedCallEvent = makeEvent("MissedCallCaptured", conversationId, {
      from: "+447700900005",
      call_sid: `CA-integration-test-${conversationId}`,
      call_status: "no-answer",
    });
    eventIds.push(missedCallEvent.event_id);
    await processPlatformEvent(supabase, missedCallEvent);

    const link = await getConversationLink(supabase, conversationId);
    expect(link, "conversation link must exist").not.toBeNull();

    const appointmentIds = [link!.callback_appointment_id].filter(Boolean) as string[];
    pending.push({ conversationId, eventIds, appointmentIds, jobIds: [], leadIds: [] });

    // A callback appointment must have been created
    expect(link!.callback_appointment_id, "callback appointment must be linked").not.toBeNull();

    const { data: appointment } = await supabase
      .schema("crm")
      .from("appointments")
      .select("id, type, title, status")
      .eq("id", link!.callback_appointment_id!)
      .single();
    if (!appointment) throw new Error("appointment row missing");

    expect(appointment.type).toBe("call");
    expect(appointment.title).toBe("Missed call recovery (no-answer)");
    expect(appointment.status).toBe("scheduled");

    // A missed-call recovery must NOT auto-create a booking job
    expect(link!.job_id).toBeNull();
    expect(link!.booking_appointment_id).toBeNull();
  });
});
