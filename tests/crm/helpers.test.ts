import { describe, expect, it } from "vitest";
import { groupAttachmentsByBucket, isImageAttachment, normalizeAttachmentType } from "@/modules/crm/lib/attachments";
import { resolveAiHubViewState } from "@/modules/crm/lib/addons";
import { buildAiHubAggregateMetrics } from "@/modules/crm/lib/ai-hub";
import { buildAssetReminderItems, expandAppointmentOccurrences } from "@/modules/crm/lib/calendar";
import { applyCrmModeFilter, crmDemoScenarioKey, crmDemoSteps, findCrmDemoStepIndex, isCrmDemoMutationBlocked } from "@/modules/crm/lib/demo";
import { buildQuoteDraftFromTemplate, buildCatalogLineItem, parsePaymentTermsInput, summarizePaymentTerms } from "@/modules/crm/lib/quote-templates";
import { buildReportsSummary } from "@/modules/crm/lib/reporting";
import type { AddonState, Appointment, Attachment, CustomerAsset, QuoteTemplate } from "@/modules/crm/types";

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
