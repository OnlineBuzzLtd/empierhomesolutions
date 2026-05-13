/**
 * Real integration tests for executePlatformCommand across 5 inbound channels.
 *
 * Each test exercises the real command-executor logic with:
 *   - A mock Supabase client whose per-table chains are individually tracked
 *   - Mocked repository helpers (getPlatformConversationLink / upsertPlatformConversationLink)
 *     so we can control what conversation-link state the executor sees
 *
 * Scenarios:
 *   1. SMS   – new customer books a boiler service   → appointment + job created (no assigned engineer)
 *   2. WhatsApp – returning customer books emergency callout  → job linked to pre-matched customer
 *   3. Voice – booking with named booking resource   → job auto-assigned to engineer
 *   4. Webchat – lead qualification only (no booking)  → lead updated, NO job created
 *   5. Missed-call – recovery task for unanswered voice call → callback appointment, NO job
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformCommandEnvelope } from "@/modules/platform/contracts";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const alias = {
  workspace_id: WORKSPACE_ID,
  tenant_id: TENANT_ID,
  created_at: "2026-04-16T20:00:00.000Z",
  updated_at: "2026-04-16T20:00:00.000Z",
};

function makeCommand(type: string, payload: Record<string, unknown>): PlatformCommandEnvelope {
  return {
    command_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    command_type: type as PlatformCommandEnvelope["command_type"],
    command_version: 1,
    workspace_id: WORKSPACE_ID,
    issued_at: "2026-04-16T20:00:00.000Z",
    source_system: "crm",
    target_system: "crm",
    idempotency_key: `test:${type}`,
    correlation_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    causation_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    aggregate: { type: "conversation", id: CONVERSATION_ID },
    payload,
  };
}

function makeBaseLink(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "link-1",
    workspace_id: WORKSPACE_ID,
    tenant_id: TENANT_ID,
    conversation_id: CONVERSATION_ID,
    customer_id: "cust-1",
    lead_id: "lead-1",
    job_id: null,
    callback_appointment_id: null,
    booking_appointment_id: null,
    latest_channel: "sms",
    identity_phone: "+447700900111",
    identity_email: null,
    metadata: {},
    latest_event_at: null,
    created_at: "2026-04-16T09:00:00.000Z",
    updated_at: "2026-04-16T09:00:00.000Z",
    ...overrides,
  };
}

/**
 * Builds a lightweight Supabase mock whose per-table chains are individually
 * observable via the returned spy references.
 */
function buildSupabaseMock(opts: { appointmentId?: string; jobId?: string; customerId?: string } = {}) {
  const aptId = opts.appointmentId ?? "appt-test-1";
  const jId = opts.jobId ?? "job-test-1";
  const cId = opts.customerId ?? "cust-test-1";

  // notes – direct insert resolve
  const notesInsert = vi.fn().mockResolvedValue({ error: null });

  // leads – update.eq.eq → { error: null }
  const leadsEq2 = vi.fn().mockResolvedValue({ error: null });
  const leadsEq1 = vi.fn().mockReturnValue({ eq: leadsEq2 });
  const leadsUpdate = vi.fn().mockReturnValue({ eq: leadsEq1 });
  // leads – insert.select.single (used if createLead is triggered)
  const leadSingle = vi.fn().mockResolvedValue({ data: { id: "lead-test-1" }, error: null });
  const leadInsertSelect = vi.fn().mockReturnValue({ single: leadSingle });
  const leadsInsert = vi.fn().mockReturnValue({ select: leadInsertSelect });

  // customers – lookup select.eq.eq.returns and insert.select.single
  const customersReturns = vi.fn().mockResolvedValue({ data: [], error: null });
  const customersEq2 = vi.fn().mockReturnValue({ returns: customersReturns });
  const customersEq1 = vi.fn().mockReturnValue({ eq: customersEq2 });
  const customersSelect = vi.fn().mockReturnValue({ eq: customersEq1 });
  const customerSingle = vi.fn().mockResolvedValue({
    data: {
      id: cId,
      tenant_id: TENANT_ID,
      full_name: "Shaz Ahmed",
      first_name: "Shaz",
      last_name: "Ahmed",
      phone: "+447779305853",
      email: "shaz@onlinebuzz.co.uk",
      address_line1: "4 Toby Way",
      city: "Romford",
      postcode: "RM7ATQ",
      archived: false,
    },
    error: null,
  });
  const customersInsertSelect = vi.fn().mockReturnValue({ single: customerSingle });
  const customersInsert = vi.fn().mockReturnValue({ select: customersInsertSelect });

  // appointments – insert.select.single and update.eq.eq
  const apptSingle = vi.fn().mockResolvedValue({ data: { id: aptId }, error: null });
  const apptInsertSelect = vi.fn().mockReturnValue({ single: apptSingle });
  const apptInsert = vi.fn().mockReturnValue({ select: apptInsertSelect });
  const apptEq2 = vi.fn().mockResolvedValue({ error: null });
  const apptEq1 = vi.fn().mockReturnValue({ eq: apptEq2 });
  const apptUpdate = vi.fn().mockReturnValue({ eq: apptEq1 });

  // jobs – insert.select.single
  const jobSingle = vi.fn().mockResolvedValue({ data: { id: jId }, error: null });
  const jobInsertSelect = vi.fn().mockReturnValue({ single: jobSingle });
  const jobInsert = vi.fn().mockReturnValue({ select: jobInsertSelect });

  const from = vi.fn().mockImplementation((table: string) => {
    switch (table) {
      case "notes":
        return { insert: notesInsert };
      case "leads":
        return { update: leadsUpdate, insert: leadsInsert };
      case "customers":
        return { select: customersSelect, insert: customersInsert };
      case "appointments":
        return { insert: apptInsert, update: apptUpdate };
      case "jobs":
        return { insert: jobInsert };
      default:
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ returns: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
          }),
        };
    }
  });

  const schema = vi.fn().mockReturnValue({ from });
  const supabase = { schema };

  return { supabase, from, apptInsert, apptUpdate, jobInsert, leadsUpdate, notesInsert, customersInsert };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("executePlatformCommand – new-customer journeys across channels", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // 1. SMS ─────────────────────────────────────────────────────────────────────

  it("SMS: creates appointment and job for a new boiler-service booking", async () => {
    const baseLink = makeBaseLink({ latest_channel: "sms" });
    const refreshedLink = makeBaseLink({
      latest_channel: "sms",
      booking_appointment_id: "appt-test-1",
    });

    const getPlatformConversationLink = vi
      .fn()
      .mockResolvedValueOnce(baseLink)   // inside ensureLeadForConversation
      .mockResolvedValueOnce(refreshedLink); // refreshed after appointment created

    const upsertPlatformConversationLink = vi.fn().mockResolvedValue(baseLink);

    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    const { supabase, apptInsert, jobInsert } = buildSupabaseMock();
    const { executePlatformCommand } = await import("@/modules/platform/lib/command-executor");

    await executePlatformCommand(
      supabase as never,
      alias,
      makeCommand("CreateOrUpdateAppointment", {
        channel: "sms",
        booking_start_at: "2026-04-17T09:00:00.000Z",
        booking_end_at: "2026-04-17T10:00:00.000Z",
        booking_slot_label: "Thu 09:00-10:00",
        treatmentType: "Boiler Service",
        message_summary: "Customer reported no hot water.",
      }),
    );

    // appointment created with correct type
    expect(apptInsert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "booking", title: "Booked visit: Boiler Service (Thu 09:00-10:00)" }),
    );

    // job auto-created with correct scheduling (no engineer name in this payload)
    expect(jobInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        customer_id: "cust-1",
        lead_id: "lead-1",
        title: "Booked visit: Boiler Service (Thu 09:00-10:00)",
        status: "booked",
        scheduled_date: "2026-04-17",
        scheduled_time: "09:00",
        assigned_engineer: null,
        is_demo: false,
      }),
    );

    // conversation link updated twice: once for appointment, once for job
    expect(upsertPlatformConversationLink).toHaveBeenCalledTimes(2);
    const linkCalls = upsertPlatformConversationLink.mock.calls;
    expect(linkCalls[0][2]).toMatchObject({ bookingAppointmentId: "appt-test-1" });
    expect(linkCalls[1][2]).toMatchObject({ jobId: "job-test-1" });
  });

  // 2. WhatsApp ─────────────────────────────────────────────────────────────────

  it("WhatsApp: links booking job to a pre-matched returning customer", async () => {
    const baseLink = makeBaseLink({
      latest_channel: "whatsapp",
      customer_id: "returning-cust-99",
      identity_phone: "+447700900222",
    });
    const refreshedLink = makeBaseLink({
      latest_channel: "whatsapp",
      customer_id: "returning-cust-99",
      booking_appointment_id: "appt-test-1",
    });

    const getPlatformConversationLink = vi
      .fn()
      .mockResolvedValueOnce(baseLink)
      .mockResolvedValueOnce(refreshedLink);

    const upsertPlatformConversationLink = vi.fn().mockResolvedValue(baseLink);

    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    const { supabase, apptInsert, jobInsert } = buildSupabaseMock();
    const { executePlatformCommand } = await import("@/modules/platform/lib/command-executor");

    await executePlatformCommand(
      supabase as never,
      alias,
      makeCommand("CreateOrUpdateAppointment", {
        channel: "whatsapp",
        booking_start_at: "2026-04-17T14:00:00.000Z",
        booking_end_at: "2026-04-17T15:00:00.000Z",
        booking_slot_label: "Thu 14:00-15:00",
        treatmentType: "Emergency Callout",
        message_summary: "Gas smell reported – urgent.",
        lead_score: 9,
        lead_band: "A",
      }),
    );

    // appointment created
    expect(apptInsert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "booking", title: "Booked visit: Emergency Callout (Thu 14:00-15:00)" }),
    );

    // job linked to the pre-matched returning customer
    expect(jobInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: "returning-cust-99",
        lead_id: "lead-1",
        status: "booked",
        scheduled_date: "2026-04-17",
        scheduled_time: "14:00",
        assigned_engineer: null,
        is_demo: false,
      }),
    );
  });

  // 3. Voice ─────────────────────────────────────────────────────────────────────

  it("Voice: assigns job to the named booking resource (engineer) from the payload", async () => {
    const baseLink = makeBaseLink({ latest_channel: "voice" });
    const refreshedLink = makeBaseLink({
      latest_channel: "voice",
      booking_appointment_id: "appt-test-1",
    });

    const getPlatformConversationLink = vi
      .fn()
      .mockResolvedValueOnce(baseLink)
      .mockResolvedValueOnce(refreshedLink);

    const upsertPlatformConversationLink = vi.fn().mockResolvedValue(baseLink);

    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    const { supabase, jobInsert } = buildSupabaseMock();
    const { executePlatformCommand } = await import("@/modules/platform/lib/command-executor");

    await executePlatformCommand(
      supabase as never,
      alias,
      makeCommand("CreateOrUpdateAppointment", {
        booking_start_at: "2026-04-18T08:00:00.000Z",
        booking_end_at: "2026-04-18T09:00:00.000Z",
        booking_slot_label: "Fri 08:00-09:00",
        treatmentType: "Annual Boiler Service",
        booking_resource_name: "Jack Mason", // engineer name sent by the runtime
      }),
    );

    // job must carry the engineer name so it surfaces in Jack Mason's diary
    expect(jobInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        assigned_engineer: "Jack Mason",
        scheduled_date: "2026-04-18",
        scheduled_time: "08:00",
        title: "Booked visit: Annual Boiler Service (Fri 08:00-09:00)",
        status: "booked",
        is_demo: false,
      }),
    );
  });

  // 4. Webchat ──────────────────────────────────────────────────────────────────

  it("Webchat: qualifies a lead without creating a job", async () => {
    const baseLink = makeBaseLink({ latest_channel: "web_chat" });

    const getPlatformConversationLink = vi.fn().mockResolvedValueOnce(baseLink);
    const upsertPlatformConversationLink = vi.fn().mockResolvedValue(baseLink);

    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    const { supabase, leadsUpdate, notesInsert, jobInsert } = buildSupabaseMock();
    const { executePlatformCommand } = await import("@/modules/platform/lib/command-executor");

    await executePlatformCommand(
      supabase as never,
      alias,
      makeCommand("CreateOrUpdateLeadFromConversation", {
        channel: "web_chat",
        qualification_status: "qualified",
        message_summary: "Customer interested in a new boiler installation. Budget around £3k.",
        urgency_level: "routine",
        lead_score: 7,
        lead_band: "B",
      }),
    );

    // lead status updated to "contacted" (qualification_status: "qualified" → buildLeadStatus → "contacted")
    expect(leadsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "contacted", tenant_id: TENANT_ID }),
    );

    // qualification note persisted
    expect(notesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "lead",
        entity_id: "lead-1",
        body: expect.stringContaining("AI qualification update"),
      }),
    );

    // no job should be created during a qualification-only event
    expect(jobInsert).not.toHaveBeenCalled();
  });

  // 5. Missed-call recovery ─────────────────────────────────────────────────────

  it("Missed-call: creates a callback appointment but no booking job", async () => {
    // CreateCallbackTask reads the link from upsertPlatformConversationLink, not getPlatformConversationLink
    const callbackLink = makeBaseLink({
      latest_channel: "voice",
      callback_appointment_id: null,
      customer_id: null,
      lead_id: null,
    });

    const getPlatformConversationLink = vi.fn().mockResolvedValue(callbackLink);
    const upsertPlatformConversationLink = vi.fn().mockResolvedValue(callbackLink);

    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    const { supabase, apptInsert, jobInsert } = buildSupabaseMock({ appointmentId: "callback-appt-1" });
    const { executePlatformCommand } = await import("@/modules/platform/lib/command-executor");

    await executePlatformCommand(
      supabase as never,
      alias,
      makeCommand("CreateCallbackTask", {
        from: "+447700900456",
        call_sid: "CA99988877",
        call_status: "no-answer",
      }),
    );

    // callback appointment created as "call" type
    expect(apptInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "call",
        title: "Missed call recovery (no-answer)",
        tenant_id: TENANT_ID,
      }),
    );

    // the link is updated to record the callback appointment id
    const linkUpdates = upsertPlatformConversationLink.mock.calls;
    expect(linkUpdates.some(([, , input]) => input.callbackAppointmentId === "callback-appt-1")).toBe(true);

    // crucially – no job should be auto-created for a missed-call recovery task
    expect(jobInsert).not.toHaveBeenCalled();
  });

  it("Voice escalation: creates a customer-linked follow-up appointment from callback payload", async () => {
    const baseLink = makeBaseLink({
      latest_channel: "voice",
      customer_id: null,
      lead_id: "lead-1",
      callback_appointment_id: null,
      identity_phone: "+447779305853",
    });

    const getPlatformConversationLink = vi.fn().mockResolvedValue(baseLink);
    const upsertPlatformConversationLink = vi.fn().mockResolvedValue(baseLink);

    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    const { supabase, apptInsert, apptUpdate, customersInsert, leadsUpdate, jobInsert } = buildSupabaseMock({
      appointmentId: "callback-appt-1",
      customerId: "callback-customer-1",
    });
    const { executePlatformCommand } = await import("@/modules/platform/lib/command-executor");

    await executePlatformCommand(
      supabase as never,
      alias,
      makeCommand("CreateEscalationTask", {
        channel: "voice",
        conversation_id: CONVERSATION_ID,
        customer_full_name: "Shaz Ahmed",
        customer_phone: "+447779305853",
        identity_phone: "+447779305853",
        customer_email: "shaz@onlinebuzz.co.uk",
        service_address_line1: "4 Toby Way",
        service_city: "Romford",
        customer_postcode: "RM7ATQ",
        reason: "callback_requested",
        trigger: "callback_requested",
        response_text: "The customer requested a callback.",
      }),
    );

    expect(customersInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        full_name: "Shaz Ahmed",
        phone: "+447779305853",
        email: "shaz@onlinebuzz.co.uk",
        address_line1: "4 Toby Way",
        city: "Romford",
        postcode: "RM7ATQ",
      }),
    );
    expect(leadsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        customer_id: "callback-customer-1",
      }),
    );
    expect(apptInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "follow_up",
        title: "AI escalation follow-up",
        customer_id: "callback-customer-1",
        lead_id: "lead-1",
      }),
    );
    expect(apptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        customer_id: "callback-customer-1",
      }),
    );
    expect(upsertPlatformConversationLink).toHaveBeenCalledWith(
      expect.anything(),
      alias,
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        customerId: "callback-customer-1",
      }),
    );
    expect(upsertPlatformConversationLink).toHaveBeenCalledWith(
      expect.anything(),
      alias,
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        callbackAppointmentId: "callback-appt-1",
      }),
    );
    expect(jobInsert).not.toHaveBeenCalled();
  });
});
