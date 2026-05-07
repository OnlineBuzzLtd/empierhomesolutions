/**
 * Regression tests for the "Calendar Open / Jobs order / WhatsApp booking"
 * fixes. These bugs all came from the same booking journey (a WhatsApp
 * booking) and all three would have been caught earlier with a direct test,
 * so we add one per fix:
 *
 *   (a) A BookingConfirmed payload with identity_phone but NO customerName
 *       must still produce a customer row (with a synthesized display name)
 *       so the downstream auto-job path can run.
 *   (b) listJobs orders by created_at DESC first so the page behaves like an
 *       inbox of submissions instead of a diary view.
 *   (c) deriveAppointmentEntityLink routes the Calendar "Open" button to the
 *       most specific linked entity (/jobs/{id} > /customers/{id} > /leads).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformCommandEnvelope } from "@/modules/platform/contracts";
import { deriveAppointmentEntityLink } from "@/modules/crm/lib/data";

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

// ─── (a) createCustomerFromPayload without a captured name ───────────────────

describe("LinkConversationToCustomerOrJob: WhatsApp booking without a captured name", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("synthesizes a display name from identity_phone and creates a customer row", async () => {
    const baseLink = {
      id: "link-1",
      workspace_id: WORKSPACE_ID,
      tenant_id: TENANT_ID,
      conversation_id: CONVERSATION_ID,
      customer_id: null,
      lead_id: "lead-1",
      job_id: null,
      callback_appointment_id: null,
      booking_appointment_id: null,
      latest_channel: "whatsapp",
      identity_phone: "+447700903322",
      identity_email: "shaz-wa@example.com",
      metadata: {},
      latest_event_at: null,
      created_at: "2026-04-16T09:00:00.000Z",
      updated_at: "2026-04-16T09:00:00.000Z",
    };

    const getPlatformConversationLink = vi.fn().mockResolvedValue(baseLink);
    const upsertPlatformConversationLink = vi.fn().mockResolvedValue(baseLink);

    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    // customers table mock:
    //   - select().eq().eq().returns() → empty (no existing match)
    //   - insert().select().single() → new customer row
    const customersReturns = vi.fn().mockResolvedValue({ data: [], error: null });
    const customersEq2 = vi.fn().mockReturnValue({ returns: customersReturns });
    const customersEq1 = vi.fn().mockReturnValue({ eq: customersEq2 });
    const customersSelect = vi.fn().mockReturnValue({ eq: customersEq1 });

    const customerInsertSingle = vi
      .fn()
      .mockResolvedValue({
        data: {
          id: "cust-new-1",
          tenant_id: TENANT_ID,
          full_name: "Customer +447700903322",
          first_name: "Customer",
          last_name: "+447700903322",
          phone: "+447700903322",
          email: "shaz-wa@example.com",
          address_line1: null,
          city: null,
          postcode: null,
          archived: false,
        },
        error: null,
      });
    const customerInsertReturningSelect = vi.fn().mockReturnValue({ single: customerInsertSingle });
    const customersInsert = vi.fn().mockReturnValue({ select: customerInsertReturningSelect });

    // jobs table mock: empty scan (no linkable job yet) so the flow stops at
    // the customer creation step, which is what we're asserting on. The real
    // findLinkableJobForCustomer chains select().eq().eq().order().order().returns().
    const jobsReturns = vi.fn().mockResolvedValue({ data: [], error: null });
    const jobsOrder2 = vi.fn().mockReturnValue({ returns: jobsReturns });
    const jobsOrder1 = vi.fn().mockReturnValue({ order: jobsOrder2, returns: jobsReturns });
    const jobsMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const jobsEq2 = vi.fn().mockReturnValue({ order: jobsOrder1, maybeSingle: jobsMaybeSingle });
    const jobsEq1 = vi.fn().mockReturnValue({ eq: jobsEq2, maybeSingle: jobsMaybeSingle });
    const jobsSelect = vi.fn().mockReturnValue({ eq: jobsEq1 });

    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "customers") {
        return { select: customersSelect, insert: customersInsert };
      }
      if (table === "jobs") {
        return { select: jobsSelect };
      }
      // Fallback swallow for anything else the handler touches.
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ returns: vi.fn().mockResolvedValue({ data: [], error: null }) }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }),
      };
    });

    const supabase = { schema: vi.fn().mockReturnValue({ from }) };

    const { executePlatformCommand } = await import("@/modules/platform/lib/command-executor");

    await executePlatformCommand(
      supabase as never,
      alias,
      makeCommand("LinkConversationToCustomerOrJob", {
        channel: "whatsapp",
        identity_phone: "+447700903322",
        identity_email: "shaz-wa@example.com",
      }),
    );

    expect(customersInsert).toHaveBeenCalledTimes(1);
    const insertPayload = customersInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertPayload).toMatchObject({
      tenant_id: TENANT_ID,
      phone: "+447700903322",
      email: "shaz-wa@example.com",
    });
    // The point of the fix: a captured name is no longer required - we
    // synthesize a display name from the phone identity. The exact formatting
    // is an implementation detail but it MUST contain the phone fragment so
    // the row is recognizable on /customers and /jobs.
    expect(insertPayload.full_name).toEqual(expect.stringContaining("447700903322"));

    // And the conversation link is patched with the new customer id so the
    // subsequent CreateOrUpdateAppointment branch can auto-create the job.
    const linkCalls = upsertPlatformConversationLink.mock.calls;
    expect(linkCalls.some(([, , input]) => (input as { customerId?: string }).customerId === "cust-new-1"))
      .toBe(true);
  });
});

// ─── (b) listJobs ordering ───────────────────────────────────────────────────

describe("listJobs ordering", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("orders by created_at DESC first so the page reflects submission order", async () => {
    const order2 = vi.fn().mockResolvedValue({ data: [], error: null });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    const from = vi.fn().mockReturnValue({ select });

    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: () => ({ enabled: true }),
    }));

    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServerClient: vi.fn().mockResolvedValue({ schema: vi.fn().mockReturnValue({ from }) }),
      createCrmServiceRoleClient: vi.fn(),
    }));

    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", scenarioKey: null }),
    }));

    vi.doMock("@/modules/crm/lib/demo", async () => {
      const actual = await vi.importActual<typeof import("@/modules/crm/lib/demo")>(
        "@/modules/crm/lib/demo",
      );
      return {
        ...actual,
        applyCrmModeFilter: vi.fn(),
      };
    });

    const { listJobs } = await import("@/modules/crm/lib/data");
    await listJobs("live");

    expect(order1).toHaveBeenCalledTimes(1);
    expect(order1.mock.calls[0]?.[0]).toBe("created_at");
    const primarySortOpts = order1.mock.calls[0]?.[1] as { ascending?: boolean } | undefined;
    expect(primarySortOpts?.ascending).toBe(false);

    expect(order2).toHaveBeenCalledTimes(1);
    expect(order2.mock.calls[0]?.[0]).toBe("scheduled_date");
  });
});

// ─── (c) deriveAppointmentEntityLink ─────────────────────────────────────────

describe("deriveAppointmentEntityLink", () => {
  it("routes to /jobs/{id} when the appointment has a job_id", () => {
    expect(
      deriveAppointmentEntityLink({
        job_id: "job-123",
        customer_id: "cust-1",
        customer: { id: "cust-1" },
        lead_id: "lead-1",
        lead: { id: "lead-1" },
      }),
    ).toBe("/jobs/job-123");
  });

  it("falls back to /customers/{id} when there is no job_id but a customer is linked", () => {
    expect(
      deriveAppointmentEntityLink({
        job_id: null,
        customer_id: "cust-7",
        customer: { id: "cust-7" },
        lead_id: null,
        lead: null,
      }),
    ).toBe("/customers/cust-7");

    // Also works when only the flat customer_id is present (embedded relation
    // missing because the row wasn't joined).
    expect(
      deriveAppointmentEntityLink({
        job_id: null,
        customer_id: "cust-8",
        lead_id: null,
      }),
    ).toBe("/customers/cust-8");
  });

  it("falls back to /leads when only a lead is linked", () => {
    expect(
      deriveAppointmentEntityLink({
        job_id: null,
        customer_id: null,
        customer: null,
        lead_id: "lead-42",
        lead: { id: "lead-42" },
      }),
    ).toBe("/leads");
  });

  it("falls back to /calendar for fully orphaned appointments", () => {
    expect(
      deriveAppointmentEntityLink({
        job_id: null,
        customer_id: null,
        customer: null,
        lead_id: null,
        lead: null,
      }),
    ).toBe("/calendar");
  });
});
