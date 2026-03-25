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

  it("blocks job stage progression when required fields or documents are missing", async () => {
    const single = vi.fn().mockResolvedValue({ data: { service_id: "svc-1", job_type_id: "job-1", status: "booked" }, error: null });
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
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
    const from = vi.fn().mockReturnValue({ insert });
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
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase,
          user: { id: "user-1" },
        },
      }),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn().mockResolvedValue({ valid: true, missingFields: [], missingDocuments: [] }),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn().mockReturnValue([]),
      upsertCustomFieldValues: vi.fn(),
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
    expect(insert).toHaveBeenCalledWith({
      customer_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      title: "Boiler Install",
      service_id: null,
      job_type_id: null,
      status: "enquiry",
      scheduled_date: null,
      scheduled_time: null,
      assigned_engineer: null,
      created_by: "user-1",
    });
    expect(body.job.id).toBe("job-1");
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
    const invoiceSingle = vi.fn().mockResolvedValue({ data: { id: "inv-1", invoice_number: "INV-2026-0001" }, error: null });
    const invoiceInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: invoiceSingle }) });
    const quoteUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const quoteUpdate = vi.fn().mockReturnValue({ eq: quoteUpdateEq });
    const quoteSelectEq = vi.fn().mockReturnValue({ single: quoteSingle });
    const quoteSelect = vi.fn().mockReturnValue({ eq: quoteSelectEq });
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
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase } }),
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
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase } }),
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
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/test.pdf" }, error: null }),
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
        user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        full_name: "Shaz Iqbal",
        role: "engineer",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });
    const schema = vi.fn().mockReturnValue({ from });
    const supabase = { schema };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase } }),
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
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        role: "engineer",
        full_name: "Shaz Iqbal",
        phone: null,
      },
      { onConflict: "user_id" },
    );
    expect(body.profile.role).toBe("engineer");
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
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({ error: jsonError("You do not have access to this CRM action.", 403) }),
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
});
