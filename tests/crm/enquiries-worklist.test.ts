import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

describe("enquiries worklist", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("@/modules/crm/lib/customer-promises", () => ({
      createCustomerPromiseWithClient: vi.fn().mockResolvedValue({ id: "promise-1" }),
      listCustomerPromises: vi.fn().mockResolvedValue([]),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults the leads API to the To-do enquiry filter without mixing in booking reviews", async () => {
    const pagination = { page: 1, pageSize: 25 };
    const listLeadsStrict = vi.fn().mockResolvedValue([{ id: "lead-1", assigned_to: "user-1" }]);
    const getEnquiryCounts = vi.fn().mockResolvedValue({ todoCount: 3, doneCount: 5, allCount: 8 });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      paginationFromRequestUrl: vi.fn().mockReturnValue(pagination),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase: {}, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getEnquiryCounts,
      listCustomers: vi.fn().mockResolvedValue([]),
      listJobTypes: vi.fn().mockResolvedValue([]),
      listLeadsStrict,
      listServices: vi.fn().mockResolvedValue([]),
      listUserProfiles: vi.fn().mockResolvedValue([
        {
          id: "profile-1",
          user_id: "user-1",
          full_name: "Office Owner",
          role: "admin",
          active: true,
        },
      ]),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/crm/lib/performance", () => ({
      normalizeCrmPagination: vi.fn((value) => value),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn(),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/route");
    const response = (await route.GET!(new Request("http://localhost/api/crm/leads"))) as Response;
    const body = await response.json();

    expect(listLeadsStrict).toHaveBeenCalledWith("live", pagination, "todo");
    expect(body.counts).toEqual({ todoCount: 3, doneCount: 5, allCount: 8 });
    expect(body.lookups).toEqual({
      customers: [],
      services: [],
      jobTypes: [],
      engineers: [],
      users: [
        {
          id: "profile-1",
          user_id: "user-1",
          full_name: "Office Owner",
          role: "admin",
          active: true,
        },
      ],
    });
    expect(body.recoveryCases).toEqual([]);
    expect(body.visibleCount).toBe(1);
    expect(body.items[0].owner).toEqual({ id: "profile-1", full_name: "Office Owner", role: "admin" });
  });

  it("uses the Done enquiry filter without showing unresolved booking reviews as rows", async () => {
    const pagination = { page: 1, pageSize: 25 };
    const listLeadsStrict = vi.fn().mockResolvedValue([{ id: "booked-lead-1" }]);
    const getEnquiryCounts = vi.fn().mockResolvedValue({ todoCount: 3, doneCount: 5, allCount: 8 });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      paginationFromRequestUrl: vi.fn().mockReturnValue(pagination),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase: {}, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getEnquiryCounts,
      listCustomers: vi.fn().mockResolvedValue([]),
      listJobTypes: vi.fn().mockResolvedValue([]),
      listLeadsStrict,
      listServices: vi.fn().mockResolvedValue([]),
      listUserProfiles: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/crm/lib/performance", () => ({
      normalizeCrmPagination: vi.fn((value) => value),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn(),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/route");
    const response = (await route.GET!(new Request("http://localhost/api/crm/leads?tab=done"))) as Response;
    const body = await response.json();

    expect(listLeadsStrict).toHaveBeenCalledWith("live", pagination, "done");
    expect(body.recoveryCases).toEqual([]);
    expect(body.visibleCount).toBe(1);
  });

  it("returns a visible error instead of reporting non-zero counts with an empty lead list", async () => {
    const pagination = { page: 1, pageSize: 25 };
    const listLeadsStrict = vi.fn().mockRejectedValue(new Error("PostgREST relationship error"));

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      paginationFromRequestUrl: vi.fn().mockReturnValue(pagination),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase: {}, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getEnquiryCounts: vi.fn().mockResolvedValue({ todoCount: 25, doneCount: 30, allCount: 55 }),
      listCustomers: vi.fn().mockResolvedValue([]),
      listJobTypes: vi.fn().mockResolvedValue([]),
      listLeadsStrict,
      listServices: vi.fn().mockResolvedValue([]),
      listUserProfiles: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/crm/lib/performance", () => ({
      normalizeCrmPagination: vi.fn((value) => value),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn(),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/route");
    const response = (await route.GET!(new Request("http://localhost/api/crm/leads"))) as Response;
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("Enquiries could not be loaded");
    expect(listLeadsStrict).toHaveBeenCalledWith("live", pagination, "todo");
  });

  it("links a manually created enquiry to an existing customer by phone", async () => {
    const customerLookup = {
      select: vi.fn(() => customerLookup),
      eq: vi.fn(() => customerLookup),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          tenant_id: "tenant-1",
          full_name: "Existing Customer",
          phone: "07777123456",
          email: null,
        },
        error: null,
      }),
    };
    const leadInsert = {
      insert: vi.fn(() => leadInsert),
      select: vi.fn(() => leadInsert),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "lead-1",
          customer_id: "11111111-1111-4111-8111-111111111111",
          assigned_to: null,
          next_action_at: "2026-06-25T10:00:00.000Z",
          status: "new",
          problem_description: "Boiler has stopped working.",
          notes: "Customer called the office.",
          is_demo: false,
          demo_scenario_key: null,
        },
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === "customers") return customerLookup;
      if (table === "leads") return leadInsert;
      throw new Error(`Unexpected table: ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };
    const upsertCustomFieldValues = vi.fn();

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      paginationFromRequestUrl: vi.fn(),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getEnquiryCounts: vi.fn(),
      listCustomers: vi.fn(),
      listJobTypes: vi.fn(),
      listLeadsStrict: vi.fn(),
      listServices: vi.fn(),
      listUserProfiles: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/performance", () => ({
      normalizeCrmPagination: vi.fn((value) => value),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn().mockResolvedValue({ valid: true, missingFields: [] }),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn().mockReturnValue([]),
      upsertCustomFieldValues,
    }));

    const route = await import("@/app/api/crm/leads/route");
    const response = (await route.POST!(
      new Request("http://localhost/api/crm/leads", {
        method: "POST",
        body: JSON.stringify({
          status: "new",
          source: "Manual phone call",
          customer_full_name: "Existing Customer",
          customer_phone: "07777 123456",
          problem_description: "Boiler has stopped working.",
          notes: "Customer called the office.",
          next_action_at: "2026-06-25T10:00:00.000Z",
        }),
      }),
    )) as Response;
    const body = await response.json();
    const { createCustomerPromiseWithClient } = await import("@/modules/crm/lib/customer-promises");

    expect(response.status).toBe(200);
    expect(body.lead.customer_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(customerLookup.eq).toHaveBeenCalledWith("phone", "07777123456");
    expect(leadInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        customer_id: "11111111-1111-4111-8111-111111111111",
        customer_match_result: "matched",
        matched_customer_confidence: "exact_contact",
        intake_source: "manual_crm",
        status: "new",
      }),
    );
    expect(upsertCustomFieldValues).toHaveBeenCalledWith({ entityType: "lead", entityId: "lead-1", values: [] });
    expect(createCustomerPromiseWithClient).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenant_id: "tenant-1",
        customer_id: "11111111-1111-4111-8111-111111111111",
        lead_id: "lead-1",
        due_at: "2026-06-25T10:00:00.000Z",
        channel: "phone",
        idempotency_key: "lead:lead-1:next_action:2026-06-25T10:00:00.000Z",
      }),
    );
  });

  it("creates a customer before inserting a manual enquiry when no contact match exists", async () => {
    const phoneLookup = {
      select: vi.fn(() => phoneLookup),
      eq: vi.fn(() => phoneLookup),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const emailLookup = {
      select: vi.fn(() => emailLookup),
      eq: vi.fn(() => emailLookup),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const customerInsert = {
      insert: vi.fn(() => customerInsert),
      select: vi.fn(() => customerInsert),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "22222222-2222-4222-8222-222222222222",
          tenant_id: "tenant-1",
          full_name: "New Caller",
          phone: "07111222333",
          email: "new@example.com",
        },
        error: null,
      }),
    };
    const leadInsert = {
      insert: vi.fn(() => leadInsert),
      select: vi.fn(() => leadInsert),
      single: vi.fn().mockResolvedValue({
        data: { id: "lead-2", customer_id: "22222222-2222-4222-8222-222222222222", status: "new" },
        error: null,
      }),
    };
    const customerChains = [phoneLookup, emailLookup, customerInsert];
    const from = vi.fn((table: string) => {
      if (table === "customers") return customerChains.shift();
      if (table === "leads") return leadInsert;
      throw new Error(`Unexpected table: ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      paginationFromRequestUrl: vi.fn(),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getEnquiryCounts: vi.fn(),
      listCustomers: vi.fn(),
      listJobTypes: vi.fn(),
      listLeadsStrict: vi.fn(),
      listServices: vi.fn(),
      listUserProfiles: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/performance", () => ({
      normalizeCrmPagination: vi.fn((value) => value),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn().mockResolvedValue({ valid: true, missingFields: [] }),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn().mockReturnValue([]),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/route");
    const response = (await route.POST!(
      new Request("http://localhost/api/crm/leads", {
        method: "POST",
        body: JSON.stringify({
          status: "new",
          source: "Manual phone call",
          customer_full_name: "New Caller",
          customer_phone: "07111 222333",
          customer_email: "NEW@example.com",
          customer_postcode: "sw1a 1aa",
          problem_description: "Radiator leaking.",
          notes: "Asked for a call today.",
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lead.customer_id).toBe("22222222-2222-4222-8222-222222222222");
    expect(customerInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        full_name: "New Caller",
        phone: "07111222333",
        email: "new@example.com",
        postcode: "SW1A 1AA",
        source: "Manual phone call",
        source_enum: "manual",
        notes: "Asked for a call today.",
      }),
    );
    expect(leadInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        customer_id: "22222222-2222-4222-8222-222222222222",
        customer_match_result: "new",
        matched_customer_confidence: "manual_created",
        intake_source: "manual_crm",
      }),
    );
  });

  it("returns an enriched lead from the lead detail API for overlay alerts", async () => {
    const lead = {
      id: "lead-1",
      status: "new",
      customer: { id: "customer-1", full_name: "Alex Smith", phone: "07123456789" },
      service: { id: "service-1", name: "Boiler repair" },
    };
    const getLeadById = vi.fn().mockResolvedValue(lead);

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase: {}, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getLeadById,
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/crm/lib/platform-sync", () => ({
      publishLeadUpdateToPlatform: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn(),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/[id]/route");
    const response = (await route.GET!(new Request("http://localhost/api/crm/leads/lead-1"), {
      params: Promise.resolve({ id: "lead-1" }),
    })) as Response;
    const body = await response.json();

    expect(getLeadById).toHaveBeenCalledWith("lead-1", "live");
    expect(body.lead).toEqual(lead);
  });

  it("keeps dashboard enquiry, follow-up, and AI receptionist review counts separate", async () => {
    const dashboardData = { newLeadCount: 99, followUpDueCount: 0, aiReceptionistReviewCount: 0 };
    const getDashboardData = vi.fn().mockResolvedValue(dashboardData);
    const getEnquiryCounts = vi.fn().mockResolvedValue({ todoCount: 3, doneCount: 5, allCount: 8 });
    const listAppointmentsForCalendar = vi.fn().mockResolvedValue([
      { source: "lead_follow_up", status: "scheduled", starts_at: "2026-06-25T09:00:00.000Z" },
      { source: "lead_follow_up", status: "scheduled", starts_at: "2999-06-25T09:00:00.000Z" },
    ]);
    const listBookingRecoveryCases = vi.fn().mockResolvedValue([{ id: "booking-case-1" }]);

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase: {}, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getDashboardData,
      getEnquiryCounts,
      listAppointmentsForCalendar,
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/platform/lib/booking-recovery", () => ({
      listBookingRecoveryCases,
    }));

    const route = await import("@/app/api/crm/dashboard/summary/route");
    const response = (await route.GET!()) as Response;
    const body = await response.json();

    expect(body.data.newLeadCount).toBe(3);
    expect(body.data.followUpDueCount).toBe(1);
    expect(body.data.aiReceptionistReviewCount).toBe(1);
  });
});
