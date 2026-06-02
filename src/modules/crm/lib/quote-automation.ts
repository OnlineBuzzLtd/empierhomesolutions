import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineItem, Package, PackageItem, PaymentPlan } from "@/modules/crm/types";
import { buildQuoteNumber } from "@/modules/crm/lib/numbers";
import { expandPackageToLineItems } from "@/modules/crm/lib/packages";
import { buildScheduleRows } from "@/modules/crm/lib/payment-plan";
import { computeQuoteRollup } from "@/modules/crm/lib/quote-rollup";
import { snapshotQuoteVersion } from "@/modules/crm/lib/quotes";

export type QuoteAutomationTriggerSource =
  | "booking_created"
  | "survey_completed"
  | "manual"
  | "demo_operator";

export type QuoteAutomationStatus = "created" | "skipped" | "blocked";

export type QuoteAutomationBlockerCode =
  | "feature_disabled"
  | "job_not_found"
  | "customer_missing"
  | "booking_quote_not_allowed"
  | "survey_required"
  | "survey_not_completed"
  | "package_missing"
  | "package_items_missing"
  | "office_quote_required"
  | "quote_already_exists"
  | "automation_failed";

export type QuoteAutomationBlocker = {
  code: QuoteAutomationBlockerCode;
  message: string;
};

export type QuoteAutomationResult = {
  status: QuoteAutomationStatus;
  quoteId: string | null;
  invoiceScheduleIds: string[];
  blockers: QuoteAutomationBlocker[];
  warnings: string[];
  automationMetadata: Record<string, unknown>;
};

type JobRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  service_id: string | null;
  job_type_id: string | null;
  title: string;
  description: string | null;
  visit_classification: string | null;
  commercial_stage: string | null;
  is_demo?: boolean | null;
  is_test?: boolean | null;
  demo_scenario_key?: string | null;
  customer?: { id: string; full_name: string | null } | null;
  service?: {
    id: string;
    name: string;
    ai_requires_office_quote?: boolean | null;
    ai_price_enabled?: boolean | null;
  } | null;
  job_type?: { id: string; name: string | null } | null;
};

type QuoteRow = {
  id: string;
  status: string;
};

type SurveyAssessmentRow = {
  id: string;
  status: "draft" | "completed";
  boiler_type: string | null;
  boiler_model: string | null;
  flue_route: string | null;
  gas_pipe_notes: string | null;
  condensate_notes: string | null;
  water_pressure_notes: string | null;
  radiator_notes: string | null;
  controls_notes: string | null;
  access_notes: string | null;
  parts_notes: string | null;
  risk_notes: string | null;
  engineer_notes: string | null;
  completed_at: string | null;
};

type TenantSettingsRow = {
  ai_quote_drafting_enabled?: boolean | null;
  ai_quote_drafting_mode?: string | null;
  default_payment_terms?: Record<string, unknown> | null;
};

type PackageCandidate = Package & { items?: PackageItem[] };

type DraftQuoteForJobInput = {
  supabase: SupabaseClient;
  tenantId: string;
  jobId: string;
  actorId?: string | null;
  triggerSource: QuoteAutomationTriggerSource;
  force?: boolean;
};

function blocked(
  blocker: QuoteAutomationBlocker,
  metadata: Record<string, unknown> = {},
): QuoteAutomationResult {
  return {
    status: "blocked",
    quoteId: null,
    invoiceScheduleIds: [],
    blockers: [blocker],
    warnings: [],
    automationMetadata: metadata,
  };
}

function skipped(
  quoteId: string,
  blocker: QuoteAutomationBlocker,
  metadata: Record<string, unknown> = {},
): QuoteAutomationResult {
  return {
    status: "skipped",
    quoteId,
    invoiceScheduleIds: [],
    blockers: [blocker],
    warnings: [],
    automationMetadata: metadata,
  };
}

function isSurveyVisit(job: Pick<JobRow, "visit_classification">) {
  return job.visit_classification === "survey_assessment";
}

export function isQuoteDraftingEnabledForTrigger(
  settings: TenantSettingsRow | null,
  triggerSource: QuoteAutomationTriggerSource,
) {
  if (!settings?.ai_quote_drafting_enabled) return false;
  const mode = settings.ai_quote_drafting_mode ?? "off";
  if (mode === "off") return false;
  if (triggerSource === "survey_completed" || triggerSource === "manual" || triggerSource === "demo_operator") {
    return mode === "draft_after_survey" || mode === "draft_after_booking_and_survey";
  }
  return mode === "draft_after_booking_and_survey";
}

export function selectQuoteAutomationPackage(
  packages: PackageCandidate[],
  job: Pick<JobRow, "service_id" | "job_type_id">,
): PackageCandidate | null {
  const active = packages.filter((pkg) => pkg.ai_price_enabled && pkg.is_active !== false);
  const exact = active.find((pkg) => pkg.service_id === job.service_id && pkg.job_type_id === job.job_type_id);
  if (exact) return exact;
  const serviceOnly = active.find((pkg) => pkg.service_id === job.service_id && !pkg.job_type_id);
  if (serviceOnly) return serviceOnly;
  return null;
}

function toPaymentPlan(value: Record<string, unknown> | null | undefined): PaymentPlan | null {
  if (!value) return null;
  const depositPercent = Number(value.deposit_percent ?? 0);
  const final = value.final;
  const stages = value.stages;
  if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) return null;
  return {
    deposit_percent: depositPercent,
    deposit_label: typeof value.deposit_label === "string" ? value.deposit_label : "Deposit",
    deposit_due_offset_days: Number.isFinite(Number(value.deposit_due_offset_days))
      ? Number(value.deposit_due_offset_days)
      : 0,
    stages: Array.isArray(stages)
      ? stages
          .map((stage) => {
            if (stage === null || typeof stage !== "object") return null;
            const record = stage as Record<string, unknown>;
            const percent = Number(record.percent ?? 0);
            if (!Number.isFinite(percent) || percent <= 0) return null;
            return {
              label: typeof record.label === "string" ? record.label : "Stage payment",
              percent,
              due_offset_days: Number.isFinite(Number(record.due_offset_days))
                ? Number(record.due_offset_days)
                : 14,
            };
          })
          .filter((stage): stage is PaymentPlan["stages"][number] => stage !== null)
      : [],
    final:
      final !== null && typeof final === "object"
        ? {
            label: typeof (final as Record<string, unknown>).label === "string"
              ? String((final as Record<string, unknown>).label)
              : "Final payment",
            due_offset_days: Number.isFinite(Number((final as Record<string, unknown>).due_offset_days))
              ? Number((final as Record<string, unknown>).due_offset_days)
              : 30,
          }
        : { label: "Final payment", due_offset_days: 30 },
  };
}

export function buildAutomationPaymentPlan(
  settings: TenantSettingsRow | null,
  job: Pick<JobRow, "visit_classification">,
): PaymentPlan {
  const configured = toPaymentPlan(settings?.default_payment_terms);
  if (configured) return configured;
  if (isSurveyVisit(job)) {
    return {
      deposit_percent: 30,
      deposit_label: "Deposit",
      deposit_due_offset_days: 0,
      stages: [],
      final: { label: "Final balance", due_offset_days: 0 },
    };
  }
  return {
    deposit_percent: 0,
    stages: [],
    final: { label: "Final invoice", due_offset_days: 0 },
  };
}

function buildInstallScope(job: JobRow, survey: SurveyAssessmentRow | null, pkg: PackageCandidate) {
  return {
    source: "ai_quote_drafting",
    package_name: pkg.name,
    service_name: job.service?.name ?? null,
    job_type_name: job.job_type?.name ?? null,
    boiler_type: survey?.boiler_type ?? null,
    boiler_model: survey?.boiler_model ?? null,
    flue_route: survey?.flue_route ?? null,
    gas_pipe_notes: survey?.gas_pipe_notes ?? null,
    condensate_notes: survey?.condensate_notes ?? null,
    water_pressure_notes: survey?.water_pressure_notes ?? null,
    radiator_notes: survey?.radiator_notes ?? null,
    controls_notes: survey?.controls_notes ?? null,
    access_notes: survey?.access_notes ?? null,
    parts_notes: survey?.parts_notes ?? null,
    risk_notes: survey?.risk_notes ?? null,
    engineer_notes: survey?.engineer_notes ?? null,
  };
}

function buildPaymentTerms(plan: PaymentPlan) {
  const hasDeposit = plan.deposit_percent > 0;
  return {
    deposit_terms: hasDeposit ? `${plan.deposit_percent}% deposit due on acceptance` : null,
    balance_terms: plan.final.label,
    plan,
  };
}

async function nextQuoteNumberForClient(supabase: SupabaseClient) {
  const { data, error } = await supabase.schema("crm").rpc("next_sequence", { p_sequence_key: "quote" });
  if (error) throw error;
  return buildQuoteNumber(Number(data));
}

async function loadJob(supabase: SupabaseClient, tenantId: string, jobId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("jobs")
    .select(
      "id, tenant_id, customer_id, service_id, job_type_id, title, description, visit_classification, commercial_stage, is_demo, is_test, demo_scenario_key, customer:customers(id, full_name), service:services(id, name, ai_requires_office_quote, ai_price_enabled), job_type:job_types(id, name)",
    )
    .eq("tenant_id", tenantId)
    .eq("id", jobId)
    .maybeSingle<JobRow>();
  if (error) throw error;
  return data ?? null;
}

async function loadSettings(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("tenant_settings")
    .select("ai_quote_drafting_enabled, ai_quote_drafting_mode, default_payment_terms")
    .eq("tenant_id", tenantId)
    .maybeSingle<TenantSettingsRow>();
  if (error) throw error;
  return data ?? null;
}

async function loadExistingQuote(supabase: SupabaseClient, tenantId: string, jobId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("quotes")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("job_id", jobId)
    .in("status", ["draft", "sent", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<QuoteRow>();
  if (error) throw error;
  return data ?? null;
}

async function loadSurvey(supabase: SupabaseClient, tenantId: string, jobId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("job_survey_assessments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("job_id", jobId)
    .maybeSingle<SurveyAssessmentRow>();
  if (error) throw error;
  return data ?? null;
}

async function loadPackages(supabase: SupabaseClient, tenantId: string) {
  const { data: packages, error: packageError } = await supabase
    .schema("crm")
    .from("packages")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("ai_visible", true)
    .eq("ai_price_enabled", true)
    .order("created_at", { ascending: false })
    .returns<PackageCandidate[]>();
  if (packageError) throw packageError;
  return packages ?? [];
}

async function loadPackageItems(supabase: SupabaseClient, tenantId: string, packageId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("package_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("package_id", packageId)
    .order("sort_order", { ascending: true })
    .returns<PackageItem[]>();
  if (error) throw error;
  return data ?? [];
}

async function insertInvoiceSchedules(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    quoteId: string;
    quoteSubtotal: number;
    plan: PaymentPlan;
    isTest: boolean;
  },
) {
  const rows = buildScheduleRows(input.plan, input.quoteSubtotal);
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({
    tenant_id: input.tenantId,
    quote_id: input.quoteId,
    label: row.label,
    payment_type: row.payment_type,
    percentage: row.percentage,
    fixed_amount: row.fixed_amount,
    due_offset_days: row.due_offset_days,
    status: "planned",
    is_test: input.isTest,
  }));
  const { data, error } = await supabase
    .schema("crm")
    .from("invoice_schedules")
    .insert(payload)
    .select("id")
    .returns<Array<{ id: string }>>();
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

export async function draftQuoteForJob(input: DraftQuoteForJobInput): Promise<QuoteAutomationResult> {
  const metadataBase = {
    trigger_source: input.triggerSource,
    tenant_id: input.tenantId,
    job_id: input.jobId,
  };
  const [job, settings, existingQuote] = await Promise.all([
    loadJob(input.supabase, input.tenantId, input.jobId),
    loadSettings(input.supabase, input.tenantId),
    loadExistingQuote(input.supabase, input.tenantId, input.jobId),
  ]);

  if (!job) {
    return blocked(
      { code: "job_not_found", message: "Job was not found for this tenant." },
      metadataBase,
    );
  }
  if (!job.customer_id) {
    return blocked(
      { code: "customer_missing", message: "A customer must be linked before AI can draft a quote." },
      metadataBase,
    );
  }
  if (existingQuote) {
    return skipped(
      existingQuote.id,
      { code: "quote_already_exists", message: "A draft, sent, or accepted quote already exists for this job." },
      { ...metadataBase, existing_quote_id: existingQuote.id },
    );
  }
  if (!input.force && !isQuoteDraftingEnabledForTrigger(settings, input.triggerSource)) {
    return blocked(
      { code: "feature_disabled", message: "AI quote drafting is disabled for this tenant or trigger." },
      metadataBase,
    );
  }

  if (input.triggerSource === "booking_created" && isSurveyVisit(job)) {
    return blocked(
      { code: "survey_required", message: "This service needs a survey before AI can draft a quote." },
      metadataBase,
    );
  }
  if (input.triggerSource === "booking_created" && job.service?.ai_requires_office_quote) {
    return blocked(
      { code: "office_quote_required", message: "This service requires office quote review before pricing." },
      metadataBase,
    );
  }

  const survey = isSurveyVisit(job) ? await loadSurvey(input.supabase, input.tenantId, input.jobId) : null;
  if (isSurveyVisit(job) && survey?.status !== "completed") {
    return blocked(
      { code: "survey_not_completed", message: "Complete the survey assessment before drafting the quote." },
      metadataBase,
    );
  }

  const packages = await loadPackages(input.supabase, input.tenantId);
  const selectedPackage = selectQuoteAutomationPackage(packages, job);
  if (!selectedPackage) {
    return blocked(
      { code: "package_missing", message: "No active AI-priced package matches this job." },
      metadataBase,
    );
  }
  if (input.triggerSource === "booking_created" && selectedPackage.ai_requires_office_quote) {
    return blocked(
      { code: "office_quote_required", message: "The matching package requires office quote review." },
      { ...metadataBase, package_id: selectedPackage.id },
    );
  }
  if (input.triggerSource === "booking_created" && selectedPackage.ai_pricing_style !== "fixed") {
    return blocked(
      {
        code: "booking_quote_not_allowed",
        message: "Booking-created quote drafting only supports fixed-price catalogue packages.",
      },
      { ...metadataBase, package_id: selectedPackage.id, pricing_style: selectedPackage.ai_pricing_style },
    );
  }

  const packageItems = await loadPackageItems(input.supabase, input.tenantId, selectedPackage.id);
  if (packageItems.length === 0) {
    return blocked(
      { code: "package_items_missing", message: "The matching package has no quote line items." },
      { ...metadataBase, package_id: selectedPackage.id },
    );
  }

  const lineItems: LineItem[] = expandPackageToLineItems(selectedPackage, packageItems);
  const vatRate = 0.2;
  const vatCategory = "standard_20";
  const rollup = computeQuoteRollup(lineItems, vatRate);
  const plan = buildAutomationPaymentPlan(settings, job);
  const paymentTerms = buildPaymentTerms(plan);
  const agentAutonomy = {
    trigger_source: input.triggerSource,
    drafted_at: new Date().toISOString(),
    package_id: selectedPackage.id,
    package_name: selectedPackage.name,
    requires_office_quote: selectedPackage.ai_requires_office_quote === true,
    pricing_style: selectedPackage.ai_pricing_style,
    guardrails: {
      auto_send: false,
      pricing_source: "catalogue_package",
    },
  };
  const isTest = job.is_test === true;

  const quotePayload = {
    tenant_id: input.tenantId,
    job_id: job.id,
    customer_id: job.customer_id,
    quote_number: await nextQuoteNumberForClient(input.supabase),
    document_type: "quote",
    current_version_number: 1,
    line_items: lineItems,
    subtotal: rollup.subtotal,
    vat_rate: vatRate,
    vat_category: vatCategory,
    total: rollup.total,
    total_cost: rollup.total_cost,
    total_profit: rollup.total_profit,
    total_margin_percent:
      rollup.total_margin_percent === null ? null : Number((rollup.total_margin_percent / 100).toFixed(4)),
    install_scope: buildInstallScope(job, survey, selectedPackage),
    payment_terms: paymentTerms,
    agent_autonomy: agentAutonomy,
    status: "draft",
    valid_until: null,
    is_demo: job.is_demo === true,
    demo_scenario_key: job.demo_scenario_key ?? null,
    is_test: isTest,
  };

  const { data: quote, error: quoteError } = await input.supabase
    .schema("crm")
    .from("quotes")
    .insert(quotePayload)
    .select("*")
    .single<{ id: string }>();
  if (quoteError || !quote) {
    throw quoteError ?? new Error("Failed to create AI quote draft.");
  }

  await snapshotQuoteVersion(input.supabase, {
    tenantId: input.tenantId,
    quoteId: quote.id,
    versionNumber: 1,
    documentType: "quote",
    lineItems,
    subtotal: rollup.subtotal,
    vatRate,
    vatCategory,
    total: rollup.total,
    installScope: quotePayload.install_scope,
    paymentTerms,
    agentAutonomy,
    validUntil: null,
    status: "draft",
    changeSummary: "AI catalogue draft",
    createdBy: input.actorId ?? null,
    isTest,
  });

  const invoiceScheduleIds = await insertInvoiceSchedules(input.supabase, {
    tenantId: input.tenantId,
    quoteId: quote.id,
    quoteSubtotal: rollup.subtotal,
    plan,
    isTest,
  });

  const { error: jobUpdateError } = await input.supabase
    .schema("crm")
    .from("jobs")
    .update({ commercial_stage: "quote_draft" })
    .eq("tenant_id", input.tenantId)
    .eq("id", job.id);
  if (jobUpdateError) {
    throw jobUpdateError;
  }

  const warnings = selectedPackage.ai_requires_office_quote
    ? ["Matching package requires office review; quote was kept as draft."]
    : [];
  const automationMetadata = {
    ...metadataBase,
    quote_id: quote.id,
    package_id: selectedPackage.id,
    invoice_schedule_ids: invoiceScheduleIds,
    status: "created",
  };
  console.info("[crm.quote_automation] draft created", automationMetadata);
  return {
    status: "created",
    quoteId: quote.id,
    invoiceScheduleIds,
    blockers: [],
    warnings,
    automationMetadata,
  };
}
