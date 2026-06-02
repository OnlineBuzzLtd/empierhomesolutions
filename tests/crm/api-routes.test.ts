import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

function normalizeBlankFields<T>(value: T) {
  return value;
}

describe("crm api routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_CALL_NUMBER = "01895 725 151";
    process.env.FORM_WEBHOOK_URL = "http://localhost:3000/api/mock-webhook";
    process.env.CONVERSION_API_SECRET = "test-conversion-secret";
  });

  it("archives a customer through the delete route", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "cust-1", archived: true }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      parseIdList: vi.fn().mockReturnValue([]),
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase } }),
    }));

    const route = await import("@/app/api/crm/customers/[id]/route");
    expect(route.DELETE).toBeTypeOf("function");
    const response = (await route.DELETE!(new Request("http://localhost"), {
      params: Promise.resolve({ id: "cust-1" }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.customer.archived).toBe(true);
    expect(update).toHaveBeenCalledWith({ archived: true });
  });

  it("returns the created primary site and site contact when creating a customer", async () => {
    const customer = {
      id: "cust-1",
      tenant_id: "tenant-1",
      full_name: "Hannah Mercer",
      first_name: "Hannah",
      last_name: "Mercer",
      phone: "07700 900111",
      email: "hannah@example.com",
      address_line1: "1 High Street",
      address_line2: null,
      city: "Uxbridge",
      postcode: "UB8 1AA",
      archived: false,
      source: null,
      created_at: "2026-05-26T00:00:00.000Z",
      updated_at: "2026-05-26T00:00:00.000Z",
    };
    const site = {
      id: "site-1",
      tenant_id: "tenant-1",
      customer_id: "cust-1",
      label: "Home",
      is_primary: true,
    };
    const siteContact = {
      id: "contact-1",
      tenant_id: "tenant-1",
      site_id: "site-1",
      full_name: "Hannah Mercer",
      is_primary: true,
    };

    const customerSingle = vi.fn().mockResolvedValue({ data: customer, error: null });
    const customerSelect = vi.fn().mockReturnValue({ single: customerSingle });
    const customerInsert = vi.fn().mockReturnValue({ select: customerSelect });

    const siteSingle = vi.fn().mockResolvedValue({ data: site, error: null });
    const siteSelect = vi.fn().mockReturnValue({ single: siteSingle });
    const siteInsert = vi.fn().mockReturnValue({ select: siteSelect });

    const siteContactSingle = vi.fn().mockResolvedValue({ data: siteContact, error: null });
    const siteContactSelect = vi.fn().mockReturnValue({ single: siteContactSingle });
    const siteContactInsert = vi.fn().mockReturnValue({ select: siteContactSelect });

    const from = vi.fn((table: string) => {
      if (table === "customers") return { insert: customerInsert };
      if (table === "sites") return { insert: siteInsert };
      if (table === "site_contacts") return { insert: siteContactInsert };
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };
    const enqueueCrmPlatformEvent = vi.fn();
    const publishPendingPlatformOutboxEvents = vi.fn();

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn().mockReturnValue([]),
      upsertCustomFieldValues: vi.fn(),
    }));
    vi.doMock("@/modules/platform/lib/outbox", () => ({
      enqueueCrmPlatformEvent,
      publishPendingPlatformOutboxEvents,
    }));

    const route = await import("@/app/api/crm/customers/route");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          first_name: "Hannah",
          last_name: "Mercer",
          phone: "07700 900111",
          email: "hannah@example.com",
          address_line1: "1 High Street",
          city: "Uxbridge",
          postcode: "UB8 1AA",
          site_label: "Home",
          site_contact_full_name: "Hannah Mercer",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.customer.id).toBe("cust-1");
    expect(body.site.id).toBe("site-1");
    expect(body.site_contact.id).toBe("contact-1");
    expect(siteInsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "tenant-1", customer_id: "cust-1" }),
    );
    expect(siteContactInsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "tenant-1", site_id: "site-1" }),
    );
    expect(enqueueCrmPlatformEvent).toHaveBeenCalled();
    expect(publishPendingPlatformOutboxEvents).toHaveBeenCalled();
  });

  it("blocks job stage progression when required fields or documents are missing", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { service_id: "svc-1", job_type_id: "job-1", status: "booked" },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      parseIdList: vi.fn().mockReturnValue([]),
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase } }),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn().mockResolvedValue({
        valid: false,
        missingFields: ["Engineer checklist"],
        missingDocuments: ["certificate"],
      }),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn().mockReturnValue([]),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/jobs/[id]/route");
    expect(route.PATCH).toBeTypeOf("function");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "job-1" }) },
    )) as Response;
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain("Engineer checklist");
    expect(body.error).toContain("certificate");
  });

  it("blocks job completion when compliance records are still open", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { service_id: "svc-1", job_type_id: "job-1", status: "booked" },
      error: null,
    });
    const jobsEq = vi.fn().mockReturnValue({ single });
    const jobsSelect = vi.fn().mockReturnValue({ eq: jobsEq });

    const hazardsEq = vi
      .fn()
      .mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: "haz-1" }], error: null }) });
    const hazardsSelect = vi.fn().mockReturnValue({ eq: hazardsEq });
    const checklistsEq = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    });
    const checklistsSelect = vi.fn().mockReturnValue({ eq: checklistsEq });
    const certificatesEq = vi
      .fn()
      .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) });
    const certificatesSelect = vi.fn().mockReturnValue({ eq: certificatesEq });

    const from = vi.fn((table: string) => {
      if (table === "jobs") return { select: jobsSelect };
      if (table === "job_hazards") return { select: hazardsSelect };
      if (table === "job_checklists") return { select: checklistsSelect };
      if (table === "job_certificates") return { select: certificatesSelect };
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      parseIdList: vi.fn().mockReturnValue([]),
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase, tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn().mockResolvedValue({
        valid: true,
        missingFields: [],
        missingDocuments: [],
      }),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn().mockReturnValue([]),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/jobs/[id]/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "job-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Resolve outstanding items");
  });

  it("creates a tenant-scoped site contact", async () => {
    const siteMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "site-1", tenant_id: "tenant-1" }, error: null });
    const siteEqTenant = vi.fn().mockReturnValue({ maybeSingle: siteMaybeSingle });
    const siteEqId = vi.fn().mockReturnValue({ eq: siteEqTenant });
    const siteSelect = vi.fn().mockReturnValue({ eq: siteEqId });

    const contactSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "contact-1", full_name: "Julie Smith" }, error: null });
    const contactInsert = vi
      .fn()
      .mockReturnValue({ select: vi.fn().mockReturnValue({ single: contactSingle }) });

    const from = vi.fn((table: string) => {
      if (table === "sites") return { select: siteSelect };
      if (table === "site_contacts") return { insert: contactInsert };
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields: vi.fn((value) => value),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" } },
      }),
    }));

    const route = await import("@/app/api/crm/site-contacts/route");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          site_id: "0f8fad5b-d9cb-469f-a165-70867728950e",
          full_name: "Julie Smith",
          phone: "07700 900123",
          email: "julie@example.com",
          role_label: "Facilities",
          is_primary: "on",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(contactInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        full_name: "Julie Smith",
        is_primary: true,
      }),
    );
    expect(body.site_contact.id).toBe("contact-1");
  });

  it("allows completion when materials were not used", async () => {
    const singleExisting = vi.fn().mockResolvedValue({
      data: {
        service_id: "svc-1",
        job_type_id: "job-type-1",
        status: "in_progress",
        scheduled_date: "2026-03-25",
        scheduled_time: "09:00:00",
        customer_id: "cust-1",
        lead_id: null,
        title: "Boiler service",
        started_at: "2026-03-25T09:00:00.000Z",
      },
      error: null,
    });
    const updateSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "job-1", status: "completed" }, error: null });
    const jobUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: updateSingle }) }),
    });
    const jobSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleExisting }) });

    const hazardsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    });
    const complianceChecklistSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      }),
    });
    const materialsChecklistSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ id: "check-1", title: "Materials used?", notes: "No", status: "completed" }],
        error: null,
      }),
    });
    const certificatesSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    });
    const attachmentsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    });

    const from = vi.fn((table: string) => {
      if (table === "jobs") return { select: jobSelect, update: jobUpdate };
      if (table === "job_hazards") return { select: hazardsSelect };
      if (table === "job_checklists") {
        return {
          select: vi.fn((columns: string) =>
            columns.includes("notes")
              ? materialsChecklistSelect(columns)
              : complianceChecklistSelect(columns),
          ),
        };
      }
      if (table === "job_certificates") return { select: certificatesSelect };
      if (table === "attachments") return { select: attachmentsSelect };
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      parseIdList: vi.fn().mockReturnValue([]),
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase, tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi
        .fn()
        .mockResolvedValue({ valid: true, missingFields: [], missingDocuments: [] }),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn().mockReturnValue([]),
      upsertCustomFieldValues: vi.fn(),
    }));
    vi.doMock("@/modules/platform/lib/outbox", () => ({
      enqueueCrmPlatformEvent: vi.fn(),
      publishPendingPlatformOutboxEvents: vi.fn(),
    }));
    vi.doMock("@/modules/crm/notifications/review-requests", () => ({
      scheduleReviewRequestsForCompletedJob: vi
        .fn()
        .mockResolvedValue({ scheduled: 0, skipped: "review_config_missing" }),
    }));

    const route = await import("@/app/api/crm/jobs/[id]/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "job-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.job.status).toBe("completed");
  });

  it("blocks completion when materials were used and no receipt is attached", async () => {
    const singleExisting = vi.fn().mockResolvedValue({
      data: {
        service_id: "svc-1",
        job_type_id: "job-type-1",
        status: "in_progress",
        scheduled_date: "2026-03-25",
        scheduled_time: "09:00:00",
        customer_id: "cust-1",
        lead_id: null,
        title: "Boiler service",
        started_at: "2026-03-25T09:00:00.000Z",
      },
      error: null,
    });
    const jobUpdate = vi.fn();
    const jobSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleExisting }) });

    const hazardsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    });
    const complianceChecklistSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      }),
    });
    const materialsChecklistSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ id: "check-1", title: "Materials used?", notes: "Yes", status: "completed" }],
        error: null,
      }),
    });
    const certificatesSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    });
    const attachmentsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    });

    const from = vi.fn((table: string) => {
      if (table === "jobs") return { select: jobSelect, update: jobUpdate };
      if (table === "job_hazards") return { select: hazardsSelect };
      if (table === "job_checklists") {
        return {
          select: vi.fn((columns: string) =>
            columns.includes("notes")
              ? materialsChecklistSelect(columns)
              : complianceChecklistSelect(columns),
          ),
        };
      }
      if (table === "job_certificates") return { select: certificatesSelect };
      if (table === "attachments") return { select: attachmentsSelect };
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      parseIdList: vi.fn().mockReturnValue([]),
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase, tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi
        .fn()
        .mockResolvedValue({ valid: true, missingFields: [], missingDocuments: [] }),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn().mockReturnValue([]),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/jobs/[id]/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "job-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Upload a receipt photo");
    expect(jobUpdate).not.toHaveBeenCalled();
  });

  it("normalizes blank optional job fields before insert", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "job-1",
        customer_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        service_id: null,
        job_type_id: null,
        scheduled_date: null,
        scheduled_time: null,
        assigned_engineer: null,
      },
      error: null,
    });
    const jobAssigneeDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const jobAssigneeDelete = vi.fn().mockReturnValue({ eq: jobAssigneeDeleteEq });
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
    const from = vi.fn((table: string) => {
      if (table === "jobs") {
        return { insert };
      }
      if (table === "job_assignees") {
        return { delete: jobAssigneeDelete };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields: vi.fn((value) => ({
        ...value,
        service_id: null,
        job_type_id: null,
        scheduled_date: null,
        scheduled_time: null,
        assigned_engineer: null,
      })),
      parseIdList: vi.fn().mockReturnValue([]),
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          user: { id: "user-1" },
          tenant: { id: "tenant-1" },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi
        .fn()
        .mockResolvedValue({ valid: true, missingFields: [], missingDocuments: [] }),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn().mockReturnValue([]),
      upsertCustomFieldValues: vi.fn(),
    }));
    vi.doMock("@/modules/platform/lib/outbox", () => ({
      enqueueCrmPlatformEvent: vi.fn(),
      publishPendingPlatformOutboxEvents: vi.fn(),
    }));

    const route = await import("@/app/api/crm/jobs/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          customer_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          title: "Boiler Install",
          service_id: "",
          job_type_id: "",
          status: "enquiry",
          scheduled_date: "",
          scheduled_time: "",
          assigned_engineer: "",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        title: "Boiler Install",
        service_id: null,
        job_type_id: null,
        status: "enquiry",
        scheduled_date: null,
        scheduled_time: null,
        assigned_engineer: null,
        created_by: "user-1",
      }),
    );
    expect(body.job.id).toBe("job-1");
  });

  it("blocks new job phase writes while the off-loop surface is hidden", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "phase-2", job_id: "job-1", name: "Install", sort_order: 2, status: "planned" },
      error: null,
    });
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
    const limit = vi.fn().mockResolvedValue({ data: [{ sort_order: 1 }], error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn((table: string) => {
      if (table === "job_phases") {
        return { select, insert };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          tenant: { id: "tenant-1" },
        },
      }),
    }));

    const route = await import("@/app/api/crm/jobs/[id]/phases/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "Install", status: "planned" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "job-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain("Job phases");
    expect(insert).not.toHaveBeenCalled();
  });

  it("blocks non-managers from approving job variations", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase: {},
          profile: { role: "sales" },
        },
      }),
    }));

    const route = await import("@/app/api/crm/jobs/[id]/variations/[variationId]/route");
    expect(route.PATCH).toBeTypeOf("function");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "job-1", variationId: "var-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Only managers");
  });

  it("converts a quote into an invoice", async () => {
    const quote = {
      id: "quote-1",
      job_id: "job-1",
      customer_id: "cust-1",
      line_items: [{ description: "Boiler", qty: 1, unit_price: 1200 }],
      subtotal: 1200,
      vat_rate: 0.2,
      vat_category: "standard_20",
      total: 1440,
    };

    const quoteSingle = vi.fn().mockResolvedValue({ data: quote, error: null });
    const invoiceSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "inv-1", invoice_number: "INV-2026-0001" }, error: null });
    const invoiceInsert = vi
      .fn()
      .mockReturnValue({ select: vi.fn().mockReturnValue({ single: invoiceSingle }) });
    const quoteUpdateEq2 = vi.fn().mockResolvedValue({ data: null, error: null });
    const quoteUpdateEq1 = vi.fn().mockReturnValue({ eq: quoteUpdateEq2 });
    const quoteUpdate = vi.fn().mockReturnValue({ eq: quoteUpdateEq1 });
    const quoteSelectEq2 = vi.fn().mockReturnValue({ single: quoteSingle });
    const quoteSelectEq1 = vi.fn().mockReturnValue({ eq: quoteSelectEq2 });
    const quoteSelect = vi.fn().mockReturnValue({ eq: quoteSelectEq1 });
    const from = vi.fn((table: string) => {
      if (table === "quotes") {
        return { select: quoteSelect, update: quoteUpdate };
      }
      if (table === "invoices") {
        return { insert: invoiceInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      nextInvoiceNumber: vi.fn().mockResolvedValue("INV-2026-0001"),
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase, tenant: { id: "tenant-1" } } }),
    }));

    const route = await import("@/app/api/crm/quotes/[id]/convert/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST!(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "quote-1" }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.invoice_number).toBe("INV-2026-0001");
    expect(quoteUpdate).toHaveBeenCalledWith({ status: "accepted" });
  });

  it("marks an invoice as paid", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "inv-1", status: "paid" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq2 = vi.fn().mockReturnValue({ select });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ update });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase, tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/notifications/invoice-chase", () => ({
      cancelInvoiceChaseSequence: vi.fn().mockResolvedValue(undefined),
    }));

    const route = await import("@/app/api/crm/invoices/[id]/mark-paid/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST!(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "inv-1" }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.status).toBe("paid");
    expect(update.mock.calls[0]?.[0]?.status).toBe("paid");
  });

  it("rejects unauthenticated quote creation before allocating a quote number", async () => {
    const nextQuoteNumber = vi.fn();

    vi.doMock("@/modules/crm/lib/api", () => ({
      computeFinancials: vi.fn().mockReturnValue({ subtotal: 100, total: 120 }),
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      nextQuoteNumber,
      parseLineItems: vi.fn().mockReturnValue([{ description: "Boiler", qty: 1, unit_price: 100 }]),
      requireCrmApiUser: vi.fn().mockResolvedValue({ error: jsonError("Authentication required.", 401) }),
    }));

    const route = await import("@/app/api/crm/quotes/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          job_id: "0f8fad5b-d9cb-469f-a165-70867728950e",
          customer_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          line_items: JSON.stringify([{ description: "Boiler", qty: 1, unit_price: 100 }]),
          vat_rate: 0.2,
          vat_category: "standard_20",
          status: "draft",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
    expect(nextQuoteNumber).not.toHaveBeenCalled();
  });

  it("returns a JSON error when quote number allocation fails", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      computeFinancials: vi.fn().mockReturnValue({ subtotal: 100, total: 120 }),
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      nextQuoteNumber: vi.fn().mockRejectedValue(new Error("Could not allocate quote number.")),
      parseLineItems: vi.fn().mockReturnValue([{ description: "Boiler", qty: 1, unit_price: 100 }]),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase: {
            schema: vi.fn(),
          },
          tenant: { id: "tenant-1" },
        },
      }),
    }));

    const route = await import("@/app/api/crm/quotes/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          job_id: "0f8fad5b-d9cb-469f-a165-70867728950e",
          customer_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          line_items: JSON.stringify([{ description: "Boiler", qty: 1, unit_price: 100 }]),
          vat_rate: 0.2,
          vat_category: "standard_20",
          status: "draft",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Could not allocate quote number.");
  });

  it("manually relinks a platform conversation and propagates the customer and job to linked CRM records", async () => {
    const customerMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "cust-2" }, error: null });
    const customerEqArchived = vi.fn().mockReturnValue({ maybeSingle: customerMaybeSingle });
    const customerEqId = vi.fn().mockReturnValue({ eq: customerEqArchived });
    const customerEqTenant = vi.fn().mockReturnValue({ eq: customerEqId });
    const customerSelect = vi.fn().mockReturnValue({ eq: customerEqTenant });

    const jobMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "job-2", customer_id: "cust-2" }, error: null });
    const jobEqId = vi.fn().mockReturnValue({ maybeSingle: jobMaybeSingle });
    const jobEqTenant = vi.fn().mockReturnValue({ eq: jobEqId });
    const jobSelect = vi.fn().mockReturnValue({ eq: jobEqTenant });

    const leadEqId = vi.fn().mockResolvedValue({ error: null });
    const leadEqTenant = vi.fn().mockReturnValue({ eq: leadEqId });
    const leadUpdate = vi.fn().mockReturnValue({ eq: leadEqTenant });

    const appointmentEqId = vi.fn().mockResolvedValue({ error: null });
    const appointmentEqTenant = vi.fn().mockReturnValue({ eq: appointmentEqId });
    const appointmentUpdate = vi.fn().mockReturnValue({ eq: appointmentEqTenant });

    const from = vi.fn((table: string) => {
      if (table === "customers") {
        return { select: customerSelect };
      }
      if (table === "jobs") {
        return { select: jobSelect };
      }
      if (table === "leads") {
        return { update: leadUpdate };
      }
      if (table === "appointments") {
        return { update: appointmentUpdate };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    const getPlatformConversationLink = vi.fn().mockResolvedValue({
      id: "link-1",
      workspace_id: "workspace-1",
      tenant_id: "tenant-1",
      conversation_id: "conv-1",
      customer_id: null,
      lead_id: "lead-1",
      job_id: null,
      callback_appointment_id: "appt-callback-1",
      booking_appointment_id: "appt-booking-1",
      latest_channel: "sms",
      identity_phone: "+447700900111",
      identity_email: null,
      metadata: {},
      latest_event_at: null,
      created_at: "2026-03-30T10:00:00.000Z",
      updated_at: "2026-03-30T10:00:00.000Z",
    });
    const upsertPlatformConversationLink = vi.fn().mockResolvedValue({
      id: "link-1",
      conversation_id: "conv-1",
      customer_id: "cust-2",
      job_id: "job-2",
    });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          user: { id: "user-1" },
          tenant: { id: "tenant-1" },
        },
      }),
    }));
    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    const route = await import("@/app/api/platform/conversations/[conversationId]/relink/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          customer_id: "22222222-2222-4222-8222-222222222222",
          job_id: "33333333-3333-4333-8333-333333333333",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ conversationId: "conv-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.link.customer_id).toBe("cust-2");
    expect(body.link.job_id).toBe("job-2");
    expect(upsertPlatformConversationLink).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ tenant_id: "tenant-1", workspace_id: "workspace-1" }),
      expect.objectContaining({ conversationId: "conv-1", customerId: "cust-2", jobId: "job-2" }),
    );
    expect(leadUpdate).toHaveBeenCalledWith({ tenant_id: "tenant-1", customer_id: "cust-2" });
    expect(appointmentUpdate).toHaveBeenCalledWith({
      tenant_id: "tenant-1",
      customer_id: "cust-2",
      job_id: "job-2",
    });
    expect(appointmentUpdate).toHaveBeenCalledTimes(2);
  });

  it("rejects manual relink when the selected job belongs to a different customer", async () => {
    const customerMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "cust-1" }, error: null });
    const customerEqArchived = vi.fn().mockReturnValue({ maybeSingle: customerMaybeSingle });
    const customerEqId = vi.fn().mockReturnValue({ eq: customerEqArchived });
    const customerEqTenant = vi.fn().mockReturnValue({ eq: customerEqId });
    const customerSelect = vi.fn().mockReturnValue({ eq: customerEqTenant });

    const jobMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "job-2", customer_id: "cust-2" }, error: null });
    const jobEqId = vi.fn().mockReturnValue({ maybeSingle: jobMaybeSingle });
    const jobEqTenant = vi.fn().mockReturnValue({ eq: jobEqId });
    const jobSelect = vi.fn().mockReturnValue({ eq: jobEqTenant });

    const from = vi.fn((table: string) => {
      if (table === "customers") {
        return { select: customerSelect };
      }
      if (table === "jobs") {
        return { select: jobSelect };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    const getPlatformConversationLink = vi.fn().mockResolvedValue({
      id: "link-1",
      workspace_id: "workspace-1",
      tenant_id: "tenant-1",
      conversation_id: "conv-1",
      customer_id: null,
      lead_id: null,
      job_id: null,
      callback_appointment_id: null,
      booking_appointment_id: null,
      latest_channel: "sms",
      identity_phone: null,
      identity_email: null,
      metadata: {},
      latest_event_at: null,
      created_at: "2026-03-30T10:00:00.000Z",
      updated_at: "2026-03-30T10:00:00.000Z",
    });
    const upsertPlatformConversationLink = vi.fn();

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          user: { id: "user-1" },
          tenant: { id: "tenant-1" },
        },
      }),
    }));
    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    const route = await import("@/app/api/platform/conversations/[conversationId]/relink/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          customer_id: "11111111-1111-4111-8111-111111111111",
          job_id: "33333333-3333-4333-8333-333333333333",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ conversationId: "conv-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("different customer");
    expect(upsertPlatformConversationLink).not.toHaveBeenCalled();
  });

  it("records quote acceptance and advances the quote status", async () => {
    const quoteSingle = vi.fn().mockResolvedValue({
      data: {
        id: "quote-1",
        document_type: "quote",
        line_items: [{ description: "Boiler", qty: 1, unit_price: 100 }],
        subtotal: 100,
        vat_rate: 0.2,
        vat_category: "standard_20",
        total: 120,
        valid_until: "2026-04-01",
        current_version_number: 1,
      },
      error: null,
    });
    const quoteUpdateSingle = vi.fn().mockResolvedValue({
      data: {
        id: "quote-1",
        document_type: "quote",
        line_items: [{ description: "Boiler", qty: 1, unit_price: 100 }],
        subtotal: 100,
        vat_rate: 0.2,
        vat_category: "standard_20",
        total: 120,
        valid_until: "2026-04-01",
        current_version_number: 2,
      },
      error: null,
    });
    const acceptanceSingle = vi.fn().mockResolvedValue({ data: { id: "accept-1" }, error: null });
    const quoteUpdateEq2 = vi
      .fn()
      .mockReturnValue({ select: vi.fn().mockReturnValue({ single: quoteUpdateSingle }) });
    const quoteUpdateEq1 = vi.fn().mockReturnValue({ eq: quoteUpdateEq2 });
    const quoteSelectEq2 = vi.fn().mockReturnValue({ single: quoteSingle });
    const quoteSelectEq1 = vi.fn().mockReturnValue({ eq: quoteSelectEq2 });
    const acceptanceUpsert = vi
      .fn()
      .mockReturnValue({ select: vi.fn().mockReturnValue({ single: acceptanceSingle }) });
    const from = vi.fn((table: string) => {
      if (table === "quotes") {
        return {
          select: vi.fn().mockReturnValue({ eq: quoteSelectEq1 }),
          update: vi.fn().mockReturnValue({ eq: quoteUpdateEq1 }),
        };
      }
      if (table === "quote_acceptances") {
        return { upsert: acceptanceUpsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          tenant: { id: "tenant-1" },
          user: { id: "user-1" },
        },
      }),
    }));
    const snapshotQuoteVersion = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/modules/crm/lib/quotes", () => ({ snapshotQuoteVersion }));
    vi.doMock("@/modules/platform/lib/outbox", () => ({
      enqueueCrmPlatformEvent: vi.fn(),
      publishPendingPlatformOutboxEvents: vi.fn(),
    }));
    vi.doMock("@/modules/crm/notifications/quote-chase", () => ({
      cancelQuoteChaseSequence: vi.fn().mockResolvedValue(undefined),
    }));

    const route = await import("@/app/api/crm/quotes/[id]/accept/route");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ accepted_by_name: "Sarah", acceptance_method: "Phone" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "quote-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(acceptanceUpsert).toHaveBeenCalled();
    expect(snapshotQuoteVersion).toHaveBeenCalled();
    expect(body.acceptance.id).toBe("accept-1");
  });

  it("generates an invoice from a planned invoice schedule", async () => {
    const scheduleSingle = vi.fn().mockResolvedValue({
      data: {
        id: "sched-1",
        label: "Deposit",
        payment_type: "deposit",
        percentage: 25,
        fixed_amount: null,
        due_offset_days: 7,
        invoice_id: null,
        quote: {
          id: "quote-1",
          job_id: "job-1",
          customer_id: "cust-1",
          subtotal: 1000,
          vat_rate: 0.2,
          vat_category: "standard_20",
        },
      },
      error: null,
    });
    const invoiceSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "inv-1", invoice_number: "INV-2026-0002" }, error: null });
    const scheduleUpdateSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "sched-1", invoice_id: "inv-1", status: "invoiced" }, error: null });
    const scheduleSelectEq2 = vi.fn().mockReturnValue({ single: scheduleSingle });
    const scheduleSelectEq1 = vi.fn().mockReturnValue({ eq: scheduleSelectEq2 });
    const scheduleUpdateEq2 = vi
      .fn()
      .mockReturnValue({ select: vi.fn().mockReturnValue({ single: scheduleUpdateSingle }) });
    const scheduleUpdateEq1 = vi.fn().mockReturnValue({ eq: scheduleUpdateEq2 });
    const from = vi.fn((table: string) => {
      if (table === "invoice_schedules") {
        return {
          select: vi.fn().mockReturnValue({ eq: scheduleSelectEq1 }),
          update: vi.fn().mockReturnValue({ eq: scheduleUpdateEq1 }),
        };
      }
      if (table === "invoices") {
        return {
          insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: invoiceSingle }) }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      nextInvoiceNumber: vi.fn().mockResolvedValue("INV-2026-0002"),
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase, tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/lib/quotes", () => ({
      calculateInvoiceScheduleAmount: vi.fn().mockReturnValue({ subtotal: 250, total: 300 }),
      buildInvoiceScheduleLineItem: vi
        .fn()
        .mockReturnValue([{ description: "Deposit (deposit)", qty: 1, unit_price: 250 }]),
    }));

    const route = await import("@/app/api/crm/invoice-schedules/[id]/generate/route");
    const response = (await route.POST!(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "sched-1" }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.invoice_number).toBe("INV-2026-0002");
    expect(body.schedule.status).toBe("invoiced");
  });

  it("returns a signed attachment URL", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "att-1", file_url: "quote/q1/test.pdf", file_name: "test.pdf", file_type: "pdf" },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase } }),
    }));
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ adminEnabled: true }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi
              .fn()
              .mockResolvedValue({ data: { signedUrl: "https://signed.example/test.pdf" }, error: null }),
          }),
        },
      }),
    }));

    const route = await import("@/app/api/crm/attachments/[id]/route");
    expect(route.GET).toBeTypeOf("function");
    const response = (await route.GET!(new Request("http://localhost"), {
      params: Promise.resolve({ id: "att-1" }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.signedUrl).toContain("signed.example");
  });

  it("updates a user profile role using the user_id conflict target", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "profile-1",
        tenant_id: "tenant-1",
        user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        full_name: "Shaz Iqbal",
        role: "engineer",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const profileUpsert = vi.fn().mockReturnValue({ select });
    const membershipUpsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "user_profiles") {
        return { upsert: profileUpsert };
      }

      if (table === "tenant_memberships") {
        return { upsert: membershipUpsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      requireManagerCrmApiUser: vi
        .fn()
        .mockResolvedValue({ session: { supabase, tenant: { id: "tenant-1" } } }),
    }));

    const route = await import("@/app/api/crm/settings/users/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          full_name: "Shaz Iqbal",
          role: "engineer",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(profileUpsert).toHaveBeenCalledWith(
      {
        tenant_id: "tenant-1",
        user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        role: "engineer",
        full_name: "Shaz Iqbal",
        phone: null,
      },
      { onConflict: "tenant_id,user_id" },
    );
    expect(membershipUpsert).toHaveBeenCalledWith(
      {
        tenant_id: "tenant-1",
        user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        role: "engineer",
        active: true,
      },
      { onConflict: "tenant_id,user_id" },
    );
    expect(body.profile.role).toBe("engineer");
  });

  it("resets a tenant user's password with a generated one-time password", async () => {
    const userId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { user_id: userId, email: "engineer@ehs.local", full_name: "Engineer" },
      error: null,
    });
    const eqUser = vi.fn().mockReturnValue({ maybeSingle });
    const eqTenant = vi.fn().mockReturnValue({ eq: eqUser });
    const select = vi.fn().mockReturnValue({ eq: eqTenant });
    const from = vi.fn((table: string) => {
      if (table === "user_profiles") return { select };
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };
    const updateUserById = vi.fn().mockResolvedValue({ error: null });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          tenant: { id: "tenant-1" },
          membership: { is_demo: false },
          profile: { is_demo: false },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({
        auth: { admin: { updateUserById } },
      }),
    }));

    const route = await import("@/app/api/crm/settings/users/[user_id]/password/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId, password: "" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ user_id: userId }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generated_password).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(updateUserById).toHaveBeenCalledWith(userId, { password: body.generated_password });
  });

  it("rejects password resets for users outside the current tenant", async () => {
    const userId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqUser = vi.fn().mockReturnValue({ maybeSingle });
    const eqTenant = vi.fn().mockReturnValue({ eq: eqUser });
    const select = vi.fn().mockReturnValue({ eq: eqTenant });
    const from = vi.fn((table: string) => {
      if (table === "user_profiles") return { select };
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };
    const updateUserById = vi.fn().mockResolvedValue({ error: null });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          tenant: { id: "tenant-1" },
          membership: { is_demo: false },
          profile: { is_demo: false },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({
        auth: { admin: { updateUserById } },
      }),
    }));

    const route = await import("@/app/api/crm/settings/users/[user_id]/password/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId, password: "new-password-123" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ user_id: userId }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("User not found");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("rejects short typed passwords for non-shortcut users before calling Supabase admin reset", async () => {
    const userId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { user_id: userId, email: "admin@ehs.local", full_name: "Admin", role: "admin" },
      error: null,
    });
    const eqUser = vi.fn().mockReturnValue({ maybeSingle });
    const eqTenant = vi.fn().mockReturnValue({ eq: eqUser });
    const select = vi.fn().mockReturnValue({ eq: eqTenant });
    const from = vi.fn((table: string) => {
      if (table === "user_profiles") return { select };
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };
    const updateUserById = vi.fn();

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          tenant: { id: "tenant-1" },
          membership: { is_demo: false },
          profile: { is_demo: false },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({
        auth: { admin: { updateUserById } },
      }),
    }));

    const route = await import("@/app/api/crm/settings/users/[user_id]/password/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId, password: "short" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ user_id: userId }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/12 characters/);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("allows the exact shortcut password for local engineer password resets", async () => {
    const userId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { user_id: userId, email: "shane@ehs.local", full_name: "Shane", role: "engineer" },
      error: null,
    });
    const eqUser = vi.fn().mockReturnValue({ maybeSingle });
    const eqTenant = vi.fn().mockReturnValue({ eq: eqUser });
    const select = vi.fn().mockReturnValue({ eq: eqTenant });
    const from = vi.fn((table: string) => {
      if (table === "user_profiles") return { select };
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };
    const updateUserById = vi.fn().mockResolvedValue({ error: null });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          tenant: { id: "tenant-1" },
          membership: { is_demo: false },
          profile: { is_demo: false },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({
        auth: { admin: { updateUserById } },
      }),
    }));

    const route = await import("@/app/api/crm/settings/users/[user_id]/password/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId, password: "password" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ user_id: userId }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generated_password).toBeNull();
    expect(updateUserById).toHaveBeenCalledWith(userId, { password: "password" });
  });

  it("rejects password resets when manager/admin access is denied", async () => {
    const userId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const updateUserById = vi.fn();

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireManagerCrmApiUser: vi
        .fn()
        .mockResolvedValue({ error: jsonError("You do not have access to this CRM action.", 403) }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({
        auth: { admin: { updateUserById } },
      }),
    }));

    const route = await import("@/app/api/crm/settings/users/[user_id]/password/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId, password: "new-password-123" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ user_id: userId }) },
    )) as Response;

    expect(response.status).toBe(403);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("blocks password resets in demo mode", async () => {
    const userId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const updateUserById = vi.fn();

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase: {},
          tenant: { id: "tenant-1" },
          membership: { is_demo: true },
          profile: { is_demo: false },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({
        auth: { admin: { updateUserById } },
      }),
    }));

    const route = await import("@/app/api/crm/settings/users/[user_id]/password/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId, password: "new-password-123" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ user_id: userId }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("read-only");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("creates a new tenant through the invite-mode signup route", async () => {
    const setCookie = vi.fn();
    const createUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "owner@example.com",
          user_metadata: { full_name: "Owner User" },
        },
      },
      error: null,
    });
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const createTenantWorkspace = vi.fn().mockResolvedValue({
      tenant: { id: "tenant-2", slug: "acme-heating", name: "Acme Heating", status: "active" },
      warnings: [],
    });

    const previousInviteCode = process.env.SIGNUP_INVITE_CODE;
    process.env.SIGNUP_INVITE_CODE = "invite-123";

    vi.doMock("next/headers", () => ({
      cookies: vi.fn().mockResolvedValue({
        set: setCookie,
      }),
    }));
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({
        auth: {
          admin: {
            createUser,
            deleteUser,
          },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/tenants", () => ({
      createTenantWorkspace,
    }));

    try {
      const route = await import("@/app/api/crm/onboarding/signup/route");
      expect(route.POST).toBeTypeOf("function");
      const response = (await route.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            business_name: "Acme Heating",
            slug: "acme-heating",
            full_name: "Owner User",
            email: "owner@example.com",
            password: "password-abc-123",
            invite_code: "invite-123",
          }),
          headers: { "Content-Type": "application/json" },
        }),
      )) as Response;
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "owner@example.com",
          email_confirm: false,
        }),
      );
      expect(createTenantWorkspace).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: "Acme Heating",
          slug: "acme-heating",
          clone_from_source: true,
        }),
      );
      expect(setCookie).toHaveBeenCalled();
      expect(body.tenant.slug).toBe("acme-heating");
      expect(body.mode).toBe("invite");
    } finally {
      if (previousInviteCode === undefined) {
        delete process.env.SIGNUP_INVITE_CODE;
      } else {
        process.env.SIGNUP_INVITE_CODE = previousInviteCode;
      }
    }
  });

  it("allows managers to start demo mode and sets the demo cookie", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonSuccess,
      normalizeBlankFields,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase: {} } }),
    }));

    const route = await import("@/app/api/crm/demo/start/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.active).toBe(true);
    expect(response.headers.get("set-cookie")).toContain("crm_demo_mode=core-walkthrough");
  });

  it("blocks non-managers from starting demo mode", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonSuccess,
      normalizeBlankFields,
      requireManagerCrmApiUser: vi
        .fn()
        .mockResolvedValue({ error: jsonError("You do not have access to this CRM action.", 403) }),
    }));

    const route = await import("@/app/api/crm/demo/start/route");
    const response = (await route.POST()) as Response;
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("access");
  });

  it("clears the demo cookie when demo mode stops", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonSuccess,
      normalizeBlankFields,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase: {} } }),
    }));

    const route = await import("@/app/api/crm/demo/stop/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.active).toBe(false);
    expect(response.headers.get("set-cookie")).toContain("crm_demo_mode=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("blocks engineer ai assist when the add-on is not available", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      parseJsonBody: vi.fn().mockResolvedValue({ success: true, data: { action: "summary" } }),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          profile: { role: "engineer" },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ active: false, mode: "live" }),
    }));
    vi.doMock("@/modules/crm/lib/addons", () => ({
      getAddonState: vi.fn().mockResolvedValue({ enabled: false, demo_enabled: false }),
      resolveEngineerAiAssistState: vi.fn().mockReturnValue("locked"),
    }));
    vi.doMock("@/modules/crm/lib/validation", () => ({
      engineerAiAssistRequestSchema: {},
    }));

    const route = await import("@/app/api/crm/jobs/[id]/ai-assist/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ action: "summary" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "job-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("AI Assist");
  });

  it("returns an engineer ai draft for the requested action", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      parseJsonBody: vi.fn().mockResolvedValue({ success: true, data: { action: "arrival_note_draft" } }),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          profile: { role: "engineer" },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ active: true, mode: "demo" }),
    }));
    vi.doMock("@/modules/crm/lib/addons", () => ({
      getAddonState: vi.fn().mockResolvedValue({ enabled: false, demo_enabled: true }),
      resolveEngineerAiAssistState: vi.fn().mockReturnValue("demo"),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getJobDetail: vi.fn().mockResolvedValue({
        job: { id: "job-1", service_id: "svc-1", job_type_id: "type-1", status: "booked" },
        notes: [],
        attachments: [],
        quote: null,
        invoice: null,
      }),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredDocuments: vi.fn().mockResolvedValue({ valid: false, missing: ["certificate"] }),
    }));
    vi.doMock("@/modules/crm/lib/engineer-ai", () => ({
      buildEngineerAiAssistDraft: vi.fn().mockReturnValue({
        action: "arrival_note_draft",
        title: "Arrival note draft",
        summary: "Structured arrival note ready to review and save.",
        body: "Arrived on site.",
        note_body: "Arrived on site.",
        checks: ["Required documents missing: certificate"],
      }),
    }));
    vi.doMock("@/modules/crm/lib/validation", () => ({
      engineerAiAssistRequestSchema: {},
    }));

    const route = await import("@/app/api/crm/jobs/[id]/ai-assist/route");
    expect(route.POST).toBeTypeOf("function");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ action: "arrival_note_draft" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "job-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draft.title).toBe("Arrival note draft");
    expect(body.access).toBe("demo");
  });

  it("searches relink customer and job candidates within the current workspace", async () => {
    const customersLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "cust-1",
          full_name: "Jane Smith",
          phone: "07700900123",
          email: "jane@example.com",
          postcode: "SW1A 1AA",
        },
        {
          id: "cust-2",
          full_name: "Alex Brown",
          phone: "07700900999",
          email: "alex@example.com",
          postcode: "M1 1AA",
        },
      ],
      error: null,
    });
    const customersOrder = vi.fn().mockReturnValue({ limit: customersLimit });
    const customersArchivedEq = vi.fn().mockReturnValue({ order: customersOrder });
    const customersTenantEq = vi.fn().mockReturnValue({ eq: customersArchivedEq });
    const customersSelect = vi.fn().mockReturnValue({ eq: customersTenantEq });

    const jobsLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "job-1",
          customer_id: "cust-1",
          title: "Boiler service",
          status: "booked",
          scheduled_date: "2026-04-01",
        },
        {
          id: "job-2",
          customer_id: "cust-2",
          title: "Fuse board upgrade",
          status: "enquiry",
          scheduled_date: "2026-04-03",
        },
      ],
      error: null,
    });
    const jobsOrder = vi.fn().mockReturnValue({ limit: jobsLimit });
    const jobsTenantEq = vi.fn().mockReturnValue({ order: jobsOrder });
    const jobsSelect = vi.fn().mockReturnValue({ eq: jobsTenantEq });

    const from = vi.fn((table: string) => {
      if (table === "customers") {
        return { select: customersSelect };
      }
      if (table === "jobs") {
        return { select: jobsSelect };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          tenant: { id: "tenant-1" },
        },
      }),
    }));

    const route = await import("@/app/api/platform/relink/search/route");
    expect(route.GET).toBeTypeOf("function");
    const response = (await route.GET(
      new Request("http://localhost/api/platform/relink/search?type=all&q=Jane"),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.customers).toHaveLength(1);
    expect(body.customers[0].id).toBe("cust-1");
    expect(body.jobs).toHaveLength(0);
  });

  it("rejects relink search queries shorter than 2 characters", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase: {},
          tenant: { id: "tenant-1" },
        },
      }),
    }));

    const route = await import("@/app/api/platform/relink/search/route");
    const response = (await route.GET(
      new Request("http://localhost/api/platform/relink/search?type=customer&q=a"),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("at least 2 characters");
  });

  it("updates review ownership for a platform conversation", async () => {
    const supabase = {};
    const getPlatformConversationLink = vi.fn().mockResolvedValue({
      id: "link-1",
      workspace_id: "workspace-1",
      tenant_id: "tenant-1",
      conversation_id: "11111111-1111-4111-8111-111111111111",
      customer_id: null,
      lead_id: null,
      job_id: null,
      callback_appointment_id: null,
      booking_appointment_id: null,
      latest_channel: "sms",
      identity_phone: null,
      identity_email: null,
      metadata: {},
      latest_event_at: "2026-03-30T10:00:00.000Z",
      created_at: "2026-03-30T10:00:00.000Z",
      updated_at: "2026-03-30T10:00:00.000Z",
    });
    const upsertPlatformConversationLink = vi.fn().mockResolvedValue({
      id: "link-1",
      workspace_id: "workspace-1",
      tenant_id: "tenant-1",
      conversation_id: "11111111-1111-4111-8111-111111111111",
      metadata: {
        review_status: "in_progress",
        review_assignee_user_id: "22222222-2222-4222-8222-222222222222",
        review_assignee_name: "Alex Manager",
      },
    });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          tenant: { id: "tenant-1" },
          user: { id: "user-1", email: "alex@example.com" },
          profile: { full_name: "Alex Manager" },
        },
      }),
    }));
    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformConversationLink,
      upsertPlatformConversationLink,
    }));

    const route = await import("@/app/api/platform/conversations/[conversationId]/review/route");
    const response = (await route.PATCH!(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          status: "in_progress",
          assignee_user_id: "22222222-2222-4222-8222-222222222222",
          assignee_name: "Alex Manager",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ conversationId: "11111111-1111-4111-8111-111111111111" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(upsertPlatformConversationLink).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ tenant_id: "tenant-1", workspace_id: "workspace-1" }),
      expect.objectContaining({
        conversationId: "11111111-1111-4111-8111-111111111111",
        metadata: expect.objectContaining({
          review_status: "in_progress",
          review_assignee_name: "Alex Manager",
        }),
      }),
    );
    expect(body.ok).toBe(true);
  });

  it("previews a manager-only deletion trail", async () => {
    const supabase = {};
    const plan = {
      root: { type: "customer", id: "cust-1", label: "Hannah Mercer" },
      planHash: "hash-1",
      blockers: [],
    };
    const buildDeleteTrailPlan = vi.fn().mockResolvedValue(plan);

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/delete-trail", () => ({
      deleteTrailRootTypes: ["customer", "job", "lead", "appointment", "ai_recovery_case"],
      buildDeleteTrailPlan,
    }));

    const route = await import("@/app/api/crm/deletion/preview/route");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ root_type: "customer", root_id: "cust-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.plan).toEqual(plan);
    expect(buildDeleteTrailPlan).toHaveBeenCalledWith({
      supabase,
      tenantId: "tenant-1",
      rootType: "customer",
      rootId: "cust-1",
    });
  });

  it("executes a deletion trail with the service role client", async () => {
    const sessionSupabase = {};
    const adminSupabase = {};
    const executeDeleteTrailPlan = vi.fn().mockResolvedValue({
      deletionRequest: { id: "del-1", status: "completed" },
      storageWarning: null,
    });

    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ adminEnabled: true }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue(adminSupabase),
    }));
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase: sessionSupabase,
          tenant: { id: "tenant-1" },
          user: { id: "user-1" },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/delete-trail", () => ({
      deleteTrailRootTypes: ["customer", "job", "lead", "appointment", "ai_recovery_case"],
      executeDeleteTrailPlan,
    }));

    const route = await import("@/app/api/crm/deletion/execute/route");
    const response = (await route.POST!(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          root_type: "customer",
          root_id: "cust-1",
          reason: "Customer requested deletion",
          plan_hash: "0123456789abcdef",
          confirmation_phrase: "DELETE CUSTOMER",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deletionRequest.status).toBe("completed");
    expect(executeDeleteTrailPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase: adminSupabase,
        storageSupabase: adminSupabase,
        tenantId: "tenant-1",
        actorId: "user-1",
        rootType: "customer",
        rootId: "cust-1",
      }),
    );
  });
});
