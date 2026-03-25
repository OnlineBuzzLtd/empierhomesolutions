import { describe, expect, it } from "vitest";
import { groupAttachmentsByBucket, isImageAttachment, normalizeAttachmentType } from "@/modules/crm/lib/attachments";
import { resolveAiHubViewState, resolveEngineerAiAssistState } from "@/modules/crm/lib/addons";
import { buildAiHubAggregateMetrics } from "@/modules/crm/lib/ai-hub";
import { buildAssetReminderItems, expandAppointmentOccurrences } from "@/modules/crm/lib/calendar";
import { summarizeEngineerDashboardJobs } from "@/modules/crm/lib/dashboard";
import { applyCrmModeFilter, crmDemoScenarioKey, crmDemoSteps, findCrmDemoStepIndex, isCrmDemoMutationBlocked, resolveCrmDemoMode } from "@/modules/crm/lib/demo";
import { buildEngineerAiAssistDraft } from "@/modules/crm/lib/engineer-ai";
import { buildQuoteDraftFromTemplate, buildCatalogLineItem, parsePaymentTermsInput, summarizePaymentTerms } from "@/modules/crm/lib/quote-templates";
import { buildReportsSummary } from "@/modules/crm/lib/reporting";
import { getAssignableEngineerNames } from "@/modules/crm/lib/staff";
import type { AddonState, Appointment, Attachment, CustomerAsset, EngineerDashboardJob, JobWithRelations, Note, QuoteTemplate } from "@/modules/crm/types";

describe("crm attachment helpers", () => {
  it("groups attachments into user-facing buckets", () => {
    const attachments: Attachment[] = [
      { id: "1", entity_type: "job", entity_id: "job-1", file_name: "before.jpg", file_url: "a", file_type: "photo", created_by: null, created_at: "2026-03-21T10:00:00.000Z" },
      { id: "2", entity_type: "job", entity_id: "job-1", file_name: "cp12.pdf", file_url: "b", file_type: "certificate", created_by: null, created_at: "2026-03-21T10:00:00.000Z" },
      { id: "3", entity_type: "job", entity_id: "job-1", file_name: "quote.pdf", file_url: "c", file_type: "quote", created_by: null, created_at: "2026-03-21T10:00:00.000Z" },
    ];

    expect(normalizeAttachmentType("  Photo ")).toBe("photo");
    expect(isImageAttachment(attachments[0])).toBe(true);
    expect(groupAttachmentsByBucket(attachments).map((group) => group.bucket)).toEqual(["photos", "compliance", "commercial"]);
  });
});

describe("crm calendar helpers", () => {
  it("expands recurring appointments within the requested window", () => {
    const appointment: Appointment = {
      id: "appt-1",
      customer_id: null,
      lead_id: null,
      job_id: null,
      assigned_to: null,
      type: "survey",
      title: "Survey visit",
      starts_at: "2026-03-21T09:00:00.000Z",
      ends_at: "2026-03-21T10:00:00.000Z",
      status: "scheduled",
      reminder_offset_minutes: null,
      recurrence_rule: "weekly",
      created_at: "2026-03-20T09:00:00.000Z",
    };

    const occurrences = expandAppointmentOccurrences(appointment, new Date("2026-03-21T00:00:00.000Z"), new Date("2026-04-10T00:00:00.000Z"));

    expect(occurrences).toHaveLength(3);
    expect(occurrences[1]?.id).toContain("appt-1:");
  });

  it("creates reminder items for service due and warranty expiry dates", () => {
    const asset: CustomerAsset & { customer?: { id: string; full_name: string; postcode: string | null } | null } = {
      id: "asset-1",
      customer_id: "cust-1",
      service_id: null,
      asset_type: "Boiler",
      make: null,
      model: null,
      serial_number: null,
      install_date: null,
      service_due_date: "2026-03-24",
      warranty_end_date: "2026-03-26",
      cylinder_type: null,
      notes: null,
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
      customer: { id: "cust-1", full_name: "Jane Smith", postcode: "E1 1AA" },
    };

    const reminders = buildAssetReminderItems(asset, new Date("2026-03-21T00:00:00.000Z"), new Date("2026-03-31T23:59:59.000Z"));

    expect(reminders.map((item) => item.source)).toEqual(["service_due", "warranty_expiry"]);
  });
});

describe("crm quote template helpers", () => {
  it("builds quote drafts from saved templates and catalog products", () => {
    const template: QuoteTemplate = {
      id: "tmpl-1",
      service_id: null,
      job_type_id: null,
      name: "Combi Boiler",
      description: null,
      line_items: [{ description: "Boiler install", qty: 1, unit_price: 2500 }],
      optional_extras: [{ description: "Mag filter", qty: 1, unit_price: 180 }],
      payment_terms: { deposit: "25% on booking", balance: "On completion" },
      active: true,
      created_at: "2026-03-21T00:00:00.000Z",
    };

    expect(buildCatalogLineItem({ name: "Wireless thermostat", sell_price: 220 })).toEqual({
      description: "Wireless thermostat",
      qty: 1,
      unit_price: 220,
    });
    expect(buildQuoteDraftFromTemplate(template)?.line_items).toEqual(template.line_items);
    expect(parsePaymentTermsInput('{\"deposit\":\"25%\"}')).toEqual({ deposit: "25%" });
    expect(summarizePaymentTerms(template.payment_terms)).toContain("deposit");
  });
});

describe("crm reporting helpers", () => {
  it("builds KPI totals and engineer workload summaries", () => {
    const summary = buildReportsSummary({
      invoices: [
        { total: 1200, status: "paid" },
        { total: 800, status: "unpaid" },
      ],
      leads: [{ status: "new" }, { status: "booked" }],
      jobs: [
        { status: "completed", assigned_engineer: "Alex" },
        { status: "booked", assigned_engineer: "Alex" },
        { status: "in_progress", assigned_engineer: null },
      ],
      expenses: [{ amount: 300 }],
    });

    expect(summary.totalRevenue).toBe(2000);
    expect(summary.unpaidRevenue).toBe(800);
    expect(summary.profitEstimate).toBe(1700);
    expect(summary.engineerWorkload[0]).toEqual({
      engineer: "Alex",
      totalJobs: 2,
      completedJobs: 1,
      openJobs: 1,
    });
  });
});

describe("crm ai hub helpers", () => {
  it("derives aggregate add-on ROI metrics", () => {
    const metrics = buildAiHubAggregateMetrics([
      {
        roi_metrics: {
          missed_calls_recovered: 14,
          bookings_captured: 6,
          leads_qualified: 19,
          average_response_minutes: 2,
        },
      },
      {
        roi_metrics: {
          missed_calls_recovered: 7,
          bookings_captured: 11,
          leads_qualified: 22,
          average_response_minutes: 1,
        },
      },
    ]);

    expect(metrics).toEqual({
      missed_calls_recovered: 21,
      bookings_captured: 17,
      leads_qualified: 41,
      average_response_minutes: 2,
    });
  });

  it("resolves the AI Hub state from add-on and role", () => {
    const addon: AddonState = {
      addon_key: "ai_comms_hub",
      enabled: false,
      demo_enabled: true,
      display_name: "AI Hub",
      price_label: "From GBP 299/mo per company",
      cta_url: null,
      summary: "Demo add-on",
    };

    expect(resolveAiHubViewState(addon, "sales")).toBe("locked");
    expect(resolveAiHubViewState(addon, "management")).toBe("demo");
    expect(resolveAiHubViewState({ ...addon, enabled: true }, "sales")).toBe("enabled");
    expect(resolveEngineerAiAssistState(addon, "engineer", false)).toBe("locked");
    expect(resolveEngineerAiAssistState(addon, "engineer", true)).toBe("demo");
    expect(resolveEngineerAiAssistState({ ...addon, enabled: true }, "engineer", false)).toBe("enabled");
  });
});

describe("crm staff helpers", () => {
  it("returns only active engineer names for assignment", () => {
    expect(
      getAssignableEngineerNames([
        { full_name: " Demo Engineer ", role: "engineer", active: true },
        { full_name: "Demo Manager", role: "management", active: true },
        { full_name: "Inactive Engineer", role: "engineer", active: false },
        { full_name: "demo engineer", role: "engineer", active: true },
      ]),
    ).toEqual(["Demo Engineer"]);
  });
});

describe("crm demo mode helpers", () => {
  it("locks demo users into demo data even without a cookie", () => {
    expect(resolveCrmDemoMode({ cookieValue: null, isDemoUser: true })).toEqual({
      active: true,
      mode: "demo",
      scenarioKey: crmDemoScenarioKey,
      locked: true,
    });
  });

  it("keeps real users in live mode unless the demo cookie is set", () => {
    expect(resolveCrmDemoMode({ cookieValue: null, isDemoUser: false })).toEqual({
      active: false,
      mode: "live",
      scenarioKey: null,
      locked: false,
    });

    expect(resolveCrmDemoMode({ cookieValue: crmDemoScenarioKey, isDemoUser: false })).toEqual({
      active: true,
      mode: "demo",
      scenarioKey: crmDemoScenarioKey,
      locked: false,
    });
  });
});

describe("crm dashboard helpers", () => {
  it("prioritizes overdue and due-today assigned jobs for engineer dashboards", () => {
    const jobs = [
      {
        id: "job-overdue",
        customer_id: "cust-1",
        lead_id: null,
        service_id: null,
        job_type_id: null,
        title: "Overdue boiler repair",
        description: null,
        scheduled_date: "2026-03-24",
        scheduled_time: "08:30:00",
        duration_hours: null,
        status: "booked",
        assigned_engineer: "Demo Engineer",
        created_by: null,
        created_at: "2026-03-24T08:00:00.000Z",
        updated_at: "2026-03-24T08:00:00.000Z",
        latestNote: null,
        attachmentCount: 0,
        hasQuote: false,
        hasInvoice: false,
        missingNote: true,
        missingPhoto: true,
        missingRequiredDocument: true,
        overdue: true,
      },
      {
        id: "job-today",
        customer_id: "cust-2",
        lead_id: null,
        service_id: null,
        job_type_id: null,
        title: "Today install",
        description: null,
        scheduled_date: "2026-03-25",
        scheduled_time: "11:00:00",
        duration_hours: null,
        status: "booked",
        assigned_engineer: "Demo Engineer",
        created_by: null,
        created_at: "2026-03-25T07:30:00.000Z",
        updated_at: "2026-03-25T07:30:00.000Z",
        latestNote: { body: "Customer asked to ring on arrival", created_at: "2026-03-25T07:45:00.000Z" },
        attachmentCount: 1,
        hasQuote: true,
        hasInvoice: false,
        missingNote: false,
        missingPhoto: false,
        missingRequiredDocument: false,
        overdue: false,
      },
    ] satisfies EngineerDashboardJob[];

    const summary = summarizeEngineerDashboardJobs(jobs, "2026-03-25");

    expect(summary.nextAssignedJob?.id).toBe("job-overdue");
    expect(summary.todaysAssignedJobs.map((job) => job.id)).toEqual(["job-today"]);
    expect(summary.overdueAssignedJobs.map((job) => job.id)).toEqual(["job-overdue"]);
    expect(summary.fieldTaskCounts).toEqual({
      missingNotes: 1,
      missingPhotos: 1,
      missingRequiredDocuments: 1,
      overdueJobs: 1,
    });
  });

  it("falls back to the next upcoming assigned job when nothing is due today", () => {
    const jobs = [
      {
        id: "job-upcoming",
        customer_id: "cust-3",
        lead_id: null,
        service_id: null,
        job_type_id: null,
        title: "Upcoming service visit",
        description: null,
        scheduled_date: "2026-03-27",
        scheduled_time: "09:30:00",
        duration_hours: null,
        status: "booked",
        assigned_engineer: "Demo Engineer",
        created_by: null,
        created_at: "2026-03-25T09:00:00.000Z",
        updated_at: "2026-03-25T09:00:00.000Z",
        latestNote: null,
        attachmentCount: 0,
        hasQuote: false,
        hasInvoice: false,
        missingNote: true,
        missingPhoto: true,
        missingRequiredDocument: false,
        overdue: false,
      },
    ] satisfies EngineerDashboardJob[];

    const summary = summarizeEngineerDashboardJobs(jobs, "2026-03-25");

    expect(summary.nextAssignedJob?.id).toBe("job-upcoming");
    expect(summary.todaysAssignedJobs).toEqual([]);
    expect(summary.readyJobs).toEqual([]);
    expect(summary.upcomingAssignedJobs.map((job) => job.id)).toEqual(["job-upcoming"]);
  });
});

describe("crm engineer ai helpers", () => {
  it("builds note-ready drafts and evidence checks from job context", () => {
    const job: JobWithRelations = {
      id: "job-1",
      customer_id: "cust-1",
      lead_id: null,
      service_id: "svc-1",
      job_type_id: "type-1",
      title: "Boiler service",
      description: "Investigate low pressure and service the existing boiler.",
      scheduled_date: "2026-03-25",
      scheduled_time: "09:00:00",
      duration_hours: 2,
      status: "booked",
      assigned_engineer: "Demo Engineer",
      created_by: null,
      created_at: "2026-03-25T08:00:00.000Z",
      updated_at: "2026-03-25T08:00:00.000Z",
      customer: {
        id: "cust-1",
        full_name: "Sarah Thompson",
        phone: "07700 900123",
        address_line1: "18 Ash Grove",
        postcode: "LE5 2AB",
      },
      service: { id: "svc-1", name: "Boilers" },
      job_type: { id: "type-1", name: "Service" },
    };
    const notes: Note[] = [
      {
        id: "note-1",
        entity_type: "job",
        entity_id: "job-1",
        body: "Customer asked for a call on arrival.",
        created_by: null,
        created_at: "2026-03-24T18:00:00.000Z",
      },
    ];
    const attachments: Attachment[] = [
      {
        id: "att-1",
        entity_type: "job",
        entity_id: "job-1",
        file_name: "before.jpg",
        file_url: "/demo/before.jpg",
        file_type: "photo",
        created_by: null,
        created_at: "2026-03-24T18:05:00.000Z",
      },
    ];

    const completionDraft = buildEngineerAiAssistDraft(
      {
        job,
        notes,
        attachments,
        quote: null,
        invoice: null,
        missingDocuments: ["certificate"],
      },
      "completion_note_draft",
    );
    const evidenceDraft = buildEngineerAiAssistDraft(
      {
        job,
        notes,
        attachments,
        quote: null,
        invoice: null,
        missingDocuments: ["certificate"],
      },
      "missing_evidence_check",
    );

    expect(completionDraft.note_body).toContain("Work completed on Boiler service");
    expect(completionDraft.body).toContain("Outstanding documents: certificate.");
    expect(evidenceDraft.note_body).toBeNull();
    expect(evidenceDraft.checks).toContain("Required documents missing: certificate");
  });
});

describe("crm demo helpers", () => {
  it("keeps the walkthrough config route order intact", () => {
    expect(crmDemoSteps.map((step) => step.route)).toEqual([
      "/dashboard",
      "/leads",
      "/customers",
      "/jobs",
      "/calendar",
      "/quotes",
      "/invoices",
      "/staff",
      "/reports",
      "/settings",
    ]);
    expect(findCrmDemoStepIndex("/quotes/123")).toBe(5);
    expect(crmDemoSteps.every((step) => step.playback.fields.length > 0)).toBe(true);
    expect(crmDemoSteps.every((step) => step.playback.artifacts.length > 0)).toBe(true);
  });

  it("applies live and demo dataset filters consistently", () => {
    const trackedQuery = {
      calls: [] as Array<[string, unknown]>,
      eq(column: string, value: unknown) {
        this.calls.push([column, value]);
        return this;
      },
    };

    applyCrmModeFilter(trackedQuery, "live");
    expect(trackedQuery.calls).toEqual([["is_demo", false]]);

    trackedQuery.calls = [];
    applyCrmModeFilter(trackedQuery, "demo", crmDemoScenarioKey);
    expect(trackedQuery.calls).toEqual([
      ["is_demo", true],
      ["demo_scenario_key", crmDemoScenarioKey],
    ]);
  });

  it("blocks CRM mutations when demo mode is active", () => {
    expect(isCrmDemoMutationBlocked("/api/crm/quotes", "POST", true)).toBe(true);
    expect(isCrmDemoMutationBlocked("/api/crm/demo/start", "POST", true)).toBe(false);
    expect(isCrmDemoMutationBlocked("/api/crm/quotes", "GET", true)).toBe(false);
    expect(isCrmDemoMutationBlocked("/dashboard", "POST", true)).toBe(false);
  });
});
