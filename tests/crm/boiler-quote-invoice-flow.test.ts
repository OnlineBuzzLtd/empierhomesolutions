import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

describe("boiler quote and invoice flow routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("blocks engineers from generating invoice schedule invoices", async () => {
    const requireCrmApiUser = vi.fn().mockResolvedValue({
      error: jsonError("You do not have access to this CRM action.", 403),
    });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      nextInvoiceNumber: vi.fn(),
      requireCrmApiUser,
    }));

    const route = await import("@/app/api/crm/invoice-schedules/[id]/generate/route");
    const response = (await route.POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "sched-1" }),
    })) as Response;

    expect(response.status).toBe(403);
    expect(requireCrmApiUser).toHaveBeenCalledWith(["management", "admin", "sales", "accounts"]);
  });

  it("manual job quote draft route is office-role gated and calls the shared automation service", async () => {
    const draftQuoteForJob = vi.fn().mockResolvedValue({
      status: "created",
      quoteId: "quote-1",
      invoiceScheduleIds: ["sched-1"],
      blockers: [],
      warnings: [],
      automationMetadata: { trigger_source: "manual" },
    });
    const supabase = { schema: vi.fn() };
    const requireCrmApiUser = vi.fn().mockResolvedValue({
      session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
    });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser,
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
    }));
    vi.doMock("@/modules/crm/lib/quote-automation", () => ({
      draftQuoteForJob,
    }));

    const route = await import("@/app/api/crm/jobs/[id]/draft-quote/route");
    const response = (await route.POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: "job-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.quoteAutomation.quoteId).toBe("quote-1");
    expect(requireCrmApiUser).toHaveBeenCalledWith(["management", "admin", "sales", "accounts"]);
    expect(draftQuoteForJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        jobId: "job-1",
        actorId: "user-1",
        triggerSource: "manual",
        force: true,
      }),
    );
  });

  it("generates deposit invoices from invoice schedules with the schedule link", async () => {
    const insertInvoice = vi.fn().mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "inv-1", invoice_kind: "deposit", total: 300 },
          error: null,
        }),
      })),
    });
    const updateSchedule = vi.fn().mockReturnValue({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: "sched-1", status: "invoiced", invoice_id: "inv-1" },
              error: null,
            }),
          })),
        })),
      })),
    });
    const scheduleSingle = vi.fn().mockResolvedValue({
      data: {
        id: "sched-1",
        quote_id: "quote-1",
        label: "Deposit",
        payment_type: "deposit",
        percentage: 25,
        fixed_amount: null,
        due_offset_days: 0,
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
    const scheduleSelect = vi.fn().mockReturnValue({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ single: scheduleSingle })),
      })),
    });
    const from = vi.fn((table: string) => {
      if (table === "invoice_schedules") return { select: scheduleSelect, update: updateSchedule };
      if (table === "invoices") return { insert: insertInvoice };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      nextInvoiceNumber: vi.fn().mockResolvedValue("INV-2026-0001"),
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase, tenant: { id: "tenant-1" } } }),
    }));

    const route = await import("@/app/api/crm/invoice-schedules/[id]/generate/route");
    const response = (await route.POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "sched-1" }),
    })) as Response;

    expect(response.status).toBe(200);
    expect(insertInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_kind: "deposit",
        invoice_schedule_id: "sched-1",
        subtotal: 250,
        total: 300,
      }),
    );
  });

  it("records quote acceptance evidence and keeps the quote accepted event payload", async () => {
    const quote = {
      id: "quote-1",
      tenant_id: "tenant-1",
      job_id: "job-1",
      customer_id: "cust-1",
      document_type: "quote",
      current_version_number: 1,
      line_items: [{ description: "Install", qty: 1, unit_price: 1000 }],
      subtotal: 1000,
      vat_rate: 0.2,
      vat_category: "standard_20",
      total: 1200,
      valid_until: null,
      install_scope: {},
      payment_terms: {},
      agent_autonomy: {},
    };
    const updatedQuote = { ...quote, status: "accepted", current_version_number: 2 };
    const acceptance = {
      id: "acc-1",
      quote_id: "quote-1",
      accepted_by_name: "Aisha Khan",
      accepted_by_email: "aisha@example.com",
      acceptance_method: "Online acceptance",
      acceptance_channel: "online",
      evidence_url: "https://example.com/evidence.pdf",
      accepted_at: "2026-06-01T10:00:00.000Z",
    };
    const quoteSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: quote, error: null })
      .mockResolvedValueOnce({ data: updatedQuote, error: null });
    const quoteSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ single: quoteSingle })),
      })),
    }));
    const quoteUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({ single: quoteSingle })),
        })),
      })),
    }));
    const acceptanceUpsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: acceptance, error: null }),
      })),
    }));
    const versionInsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "quotes") return { select: quoteSelect, update: quoteUpdate };
      if (table === "quote_acceptances") return { upsert: acceptanceUpsert };
      if (table === "quote_versions") return { insert: versionInsert };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };
    const enqueueCrmPlatformEvent = vi.fn();

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields: vi.fn((value) => value),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
    }));
    vi.doMock("@/modules/platform/lib/outbox", () => ({
      enqueueCrmPlatformEvent,
      publishPendingPlatformOutboxEvents: vi.fn(),
    }));
    vi.doMock("@/modules/crm/notifications/quote-chase", () => ({
      cancelQuoteChaseSequence: vi.fn(),
    }));

    const route = await import("@/app/api/crm/quotes/[id]/accept/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          accepted_by_name: "Aisha Khan",
          accepted_by_email: "aisha@example.com",
          acceptance_method: "Online acceptance",
          acceptance_channel: "online",
          evidence_url: "https://example.com/evidence.pdf",
        }),
      }),
      { params: Promise.resolve({ id: "quote-1" }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(acceptanceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptance_channel: "online",
        evidence_url: "https://example.com/evidence.pdf",
      }),
      { onConflict: "quote_id" },
    );
    expect(enqueueCrmPlatformEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "QuoteAccepted",
        payload: expect.objectContaining({
          acceptance_channel: "online",
          evidence_url: "https://example.com/evidence.pdf",
        }),
      }),
    );
  });

  it("saves survey, cooling-off and compliance trail records behind tenant job checks", async () => {
    const requireCrmApiUser = vi.fn().mockResolvedValue({
      session: {
        supabase: null,
        tenant: { id: "tenant-1" },
        user: { id: "user-1" },
      },
    });
    const jobMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "job-1" }, error: null });
    const jobsSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: jobMaybeSingle })),
      })),
    }));
    const jobCommercialStageUpdate = vi.fn().mockResolvedValue({ data: null, error: null });
    const jobsUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: jobCommercialStageUpdate,
      })),
    }));
    const surveyUpsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "survey-1", status: "completed" },
          error: null,
        }),
      })),
    }));
    const coolingUpsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "cooling-1", applies: true },
          error: null,
        }),
      })),
    }));
    const complianceUpsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "compliance-1", commissioning_complete: true },
          error: null,
        }),
      })),
    }));
    const from = vi.fn((table: string) => {
      if (table === "jobs") return { select: jobsSelect, update: jobsUpdate };
      if (table === "job_survey_assessments") return { upsert: surveyUpsert };
      if (table === "job_cooling_off_consents") return { upsert: coolingUpsert };
      if (table === "job_compliance_closeouts") return { upsert: complianceUpsert };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };
    requireCrmApiUser.mockResolvedValue({
      session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
    });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields: vi.fn((value) => value),
      requireCrmApiUser,
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
    }));
    vi.doMock("@/modules/crm/lib/quote-automation", () => ({
      draftQuoteForJob: vi.fn().mockResolvedValue({
        status: "blocked",
        quoteId: null,
        invoiceScheduleIds: [],
        blockers: [{ code: "feature_disabled", message: "Disabled in test." }],
        warnings: [],
        automationMetadata: {},
      }),
    }));

    const surveyRoute = await import("@/app/api/crm/jobs/[id]/survey-assessment/route");
    const coolingRoute = await import("@/app/api/crm/jobs/[id]/cooling-off/route");
    const complianceRoute = await import("@/app/api/crm/jobs/[id]/compliance-closeout/route");
    const routeParams = { params: Promise.resolve({ id: "job-1" }) };

    const surveyResponse = (await surveyRoute.PUT!(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ boiler_type: "combi", status: "completed" }),
      }),
      routeParams,
    )) as Response;
    const coolingResponse = (await coolingRoute.PUT!(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          applies: true,
          contract_channel: "phone",
          evidence_url: "https://example.com/consent.pdf",
        }),
      }),
      routeParams,
    )) as Response;
    const complianceResponse = (await complianceRoute.PUT!(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          commissioning_complete: true,
          controls_handover_complete: true,
          gas_safe_reference: "GS-123",
        }),
      }),
      routeParams,
    )) as Response;

    expect(surveyResponse.status).toBe(200);
    expect(coolingResponse.status).toBe(200);
    expect(complianceResponse.status).toBe(200);
    expect(surveyUpsert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "tenant-1", job_id: "job-1" }), {
      onConflict: "job_id",
    });
    expect(coolingUpsert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "tenant-1", job_id: "job-1" }), {
      onConflict: "job_id",
    });
    expect(complianceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "tenant-1", job_id: "job-1" }),
      { onConflict: "job_id" },
    );
    expect(jobsUpdate).toHaveBeenCalledWith({ commercial_stage: "survey_done" });
    expect(requireCrmApiUser).toHaveBeenCalledWith(["management", "admin", "sales", "engineer"]);
    expect(requireCrmApiUser).toHaveBeenCalledWith(["management", "admin", "sales", "accounts"]);
  });

  it("creates a final balance invoice when completing a job that already has a paid deposit invoice", async () => {
    const jobExisting = {
      service_id: "svc-1",
      job_type_id: "type-1",
      status: "in_progress",
      scheduled_date: "2026-06-10",
      scheduled_time: "09:00:00",
      customer_id: "cust-1",
      lead_id: null,
      title: "Boiler install",
      started_at: "2026-06-10T09:00:00.000Z",
    };
    const jobUpdated = {
      id: "job-1",
      tenant_id: "tenant-1",
      customer_id: "cust-1",
      lead_id: null,
      title: "Boiler install",
      status: "completed",
      updated_at: "2026-06-10T16:00:00.000Z",
    };
    const acceptedQuote = {
      id: "quote-1",
      job_id: "job-1",
      customer_id: "cust-1",
      line_items: [{ description: "Boiler install", qty: 1, unit_price: 1000 }],
      subtotal: 1000,
      vat_rate: 0.2,
      vat_category: "standard_20",
      total: 1200,
    };
    const invoiceInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: "inv-final" }, error: null }),
      })),
    }));
    const invoicesSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [{ id: "inv-deposit", invoice_kind: "deposit", status: "paid", total: 300 }],
          error: null,
        }),
      })),
    }));
    const quotesSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: acceptedQuote, error: null }),
              })),
            })),
          })),
        })),
      })),
    }));
    const jobsSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: jobExisting, error: null }),
      })),
    }));
    const jobsUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: jobUpdated, error: null }),
        })),
      })),
    }));
    const hazardsSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    }));
    const complianceChecklistSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    }));
    const materialsChecklistSelect = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({
        data: [{ title: "Materials used?", notes: "No", status: "completed" }],
        error: null,
      }),
    }));
    const certificatesSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    }));
    const attachmentsSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    }));
    const from = vi.fn((table: string) => {
      if (table === "jobs") return { select: jobsSelect, update: jobsUpdate };
      if (table === "job_hazards") return { select: hazardsSelect };
      if (table === "job_checklists") {
        return {
          select: vi.fn((columns: string) =>
            columns.includes("notes")
              ? materialsChecklistSelect()
              : complianceChecklistSelect(),
          ),
        };
      }
      if (table === "job_certificates") return { select: certificatesSelect };
      if (table === "attachments") return { select: attachmentsSelect };
      if (table === "invoices") return { select: invoicesSelect, insert: invoiceInsert };
      if (table === "quotes") return { select: quotesSelect };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields: vi.fn((value) => value),
      nextInvoiceNumber: vi.fn().mockResolvedValue("INV-2026-0002"),
      parseIdList: vi.fn().mockReturnValue([]),
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase, tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn().mockResolvedValue({ valid: true, missingFields: [], missingDocuments: [] }),
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
      scheduleReviewRequestsForCompletedJob: vi.fn().mockResolvedValue({ scheduled: 0 }),
    }));
    vi.doMock("@/modules/crm/notifications/invoice-chase", () => ({
      scheduleInvoiceChaseSequence: vi.fn().mockResolvedValue({ scheduled: 1 }),
    }));

    const route = await import("@/app/api/crm/jobs/[id]/route");
    const response = (await route.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "job-1" }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(invoiceInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_kind: "final",
        balance_of_quote_id: "quote-1",
        subtotal: 750,
        total: 900,
        line_items: [expect.objectContaining({ unit_price: 750 })],
      }),
    );
  });
});
