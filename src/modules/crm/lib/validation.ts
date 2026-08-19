import { z } from "zod";
import {
  appointmentStatuses,
  appointmentTypes,
  certificationCategories,
  customFieldTypes,
  customerPromiseChannels,
  customerPromiseOrigins,
  customerPromiseStatuses,
  customerPromiseTypes,
  engineerAiAssistActions,
  expenseCategories,
  commercialStages,
  invoiceKinds,
  invoiceStatuses,
  jobCertificateStatuses,
  jobChecklistStatuses,
  jobHazardStatuses,
  jobPhaseStatuses,
  jobStatuses,
  jobVariationStatuses,
  leadStatuses,
  paymentStatuses,
  paymentTypes,
  purchaseOrderStatuses,
  quoteDocumentTypes,
  quoteStatuses,
  supplierReconciliationEntryTypes,
  supplierReconciliationStatuses,
  supportedEntityTypes,
  tradeVerticals,
  visitClassifications,
} from "@/modules/crm/types";

const emptyStringToNull = (v: unknown) => (v === "" ? null : v);

function parseCheckboxIdList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => (typeof entry === "string" ? [entry] : []))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  return [] as string[];
}

const lineItemKinds = ["line", "section_header", "package_rollup"] as const;
const lineItemPackageRoles = ["rollup", "component"] as const;

export const lineItemSchema = z.object({
  description: z.string().min(1),
  qty: z.coerce.number().nonnegative(),
  unit_price: z.coerce.number().nonnegative(),
  unit_cost: z
    .preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().nonnegative().nullable())
    .optional(),
  markup_percent: z
    .preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().nullable())
    .optional(),
  product_id: z.preprocess(emptyStringToNull, z.string().uuid().nullable()).optional(),
  package_id: z.preprocess(emptyStringToNull, z.string().uuid().nullable()).optional(),
  package_role: z.enum(lineItemPackageRoles).nullable().optional(),
  section_id: z.preprocess(emptyStringToNull, z.string().nullable()).optional(),
  kind: z.enum(lineItemKinds).nullable().optional(),
});

export const packageItemSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  description: z.string().min(1),
  qty: z.coerce.number().positive(),
  unit_cost: z
    .preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().nonnegative().nullable())
    .optional(),
  unit_price: z.coerce.number().nonnegative(),
  sort_order: z.coerce.number().int().nonnegative().default(0),
});

export const packageSchema = z
  .object({
    service_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
    job_type_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
    name: z.string().min(2),
    description: z.string().optional().nullable(),
    default_markup_percent: z
      .preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().nullable())
      .optional(),
    is_active: z.coerce.boolean().default(true),
    // Restrict to https/http only at the boundary — keeps stored URLs safe to
    // drop into <img src=…> without protocol-relative or javascript: tricks.
    image_url: z
      .preprocess((v) => (v === "" || v === undefined ? null : v), z.string().url().nullable())
      .refine((v) => v === null || /^https?:\/\//i.test(v), { message: "image_url must be http(s)" })
      .optional(),
    ai_visible: z.coerce.boolean().default(true),
    ai_bookable: z.coerce.boolean().default(false),
    ai_price_enabled: z.coerce.boolean().default(false),
    ai_requires_office_quote: z.coerce.boolean().default(true),
    ai_default_duration_minutes: z
      .preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().positive().nullable())
      .optional(),
    ai_price_disclaimer: z.string().optional().nullable(),
    ai_pricing_style: z.enum(["from", "fixed"]).default("from"),
    items: z.array(packageItemSchema).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.job_type_id && !value.service_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["job_type_id"],
        message: "Select a service before selecting a job type.",
      });
    }
    if (value.ai_price_enabled) {
      if (!value.service_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["service_id"],
          message: "Select a service before enabling AI pricing.",
        });
      }
      const publicPrice = value.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unit_price), 0);
      if (publicPrice <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message: "Add a public package price before enabling AI pricing.",
        });
      }
    }
  });

export const paymentPlanSchema = z
  .object({
    deposit_percent: z.coerce.number().min(0).max(100),
    deposit_label: z.string().min(1).default("Deposit"),
    deposit_due_offset_days: z.coerce.number().int().min(0).default(0),
    stages: z
      .array(
        z.object({
          label: z.string().min(1),
          percent: z.coerce.number().min(0).max(100),
          due_offset_days: z.coerce.number().int().min(0).default(14),
        }),
      )
      .default([]),
    final: z.object({
      label: z.string().min(1).default("Final payment"),
      due_offset_days: z.coerce.number().int().min(0).default(30),
    }),
  })
  .superRefine((value, ctx) => {
    const total = value.deposit_percent + value.stages.reduce((sum, stage) => sum + stage.percent, 0);
    if (total > 100.001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deposit_percent"],
        message: "Deposit + stages cannot exceed 100%.",
      });
    }
  });

export const publicAcceptSchema = z.object({
  accepted_by_name: z.string().min(2),
  accepted_by_email: z.string().email().optional().or(z.literal("")).nullable(),
  notes: z.string().optional().nullable(),
});

export const publicRejectSchema = z.object({
  reason: z.string().min(2).max(2000).optional().nullable(),
});

export const quoteRejectionSchema = z.object({
  reason: z.string().min(2).max(2000),
});

export const publicLinkRequestSchema = z.object({
  ttl_days: z.coerce.number().int().min(1).max(365).default(30),
});

// The raw customer field shape, with no refinement attached. Kept separate from
// `customerSchema` because zod 4 throws at runtime on `.partial()` when the
// object carries a refinement ("`.partial()` cannot be used on object schemas
// containing refinements"), and TypeScript does not catch it. The customer PATCH
// route used to call `customerSchema.partial()`, which made every customer edit
// a non-JSON 500 that the UI reported as "Unexpected response."
const customerFields = {
  full_name: z.string().min(2).optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  address_line1: z.string().optional().nullable(),
  address_line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  property_type: z.string().optional().nullable(),
  occupancy_type: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  referral_notes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
} as const;

const nameKeys = ["full_name", "first_name", "last_name"] as const;

function hasAnyName(value: Record<string, unknown>) {
  return nameKeys.some((key) => String(value[key] ?? "").trim().length > 0);
}

export const customerSchema = z
  .object({
    ...customerFields,
    archived: z.coerce.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!hasAnyName(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["first_name"],
        message: "Enter a name for the customer.",
      });
    }
  });

// Partial shape for PATCH. Note `archived` deliberately carries no `.default()`
// here: with a default, every PATCH that omits the field would silently write
// `archived = false` and un-archive the customer.
export const customerPatchSchema = z
  .object({
    ...customerFields,
    archived: z.coerce.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    // A patch may legitimately touch only the phone or the postcode. Only
    // enforce the name invariant when the caller is actually writing a name —
    // otherwise clearing every name field would be allowed to slip through.
    const touchesName = nameKeys.some((key) => value[key] !== undefined);
    if (touchesName && !hasAnyName(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["first_name"],
        message: "Enter a name for the customer.",
      });
    }
  });

export const siteContactSchema = z.object({
  site_id: z.string().uuid(),
  full_name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  role_label: z.string().optional().nullable(),
  is_primary: z.coerce.boolean().optional().default(false),
});

export const leadSchema = z.object({
  customer_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  service_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  job_type_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  status: z.enum(leadStatuses),
  lost_reason: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  assigned_to: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  next_action_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  problem_description: z.string().optional().nullable(),
  affected_area: z.string().optional().nullable(),
  urgency_level: z.string().optional().nullable(),
  preferred_date_text: z.string().optional().nullable(),
  preferred_time_window: z.string().optional().nullable(),
});

export const customerPromiseSchema = z
  .object({
    customer_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
    lead_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
    job_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
    quote_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
    invoice_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
    platform_conversation_id: z.preprocess(emptyStringToNull, z.string().optional().nullable()),
    platform_event_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
    promise_type: z.enum(customerPromiseTypes).default("follow_up"),
    title: z.string().min(2).default("Customer promise"),
    detail: z.string().optional().nullable(),
    owner_user_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
    due_at: z.string().optional().nullable(),
    channel: z.enum(customerPromiseChannels).default("phone"),
    status: z.enum(customerPromiseStatuses).default("open"),
    origin: z.enum(customerPromiseOrigins).default("office"),
    idempotency_key: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const hasLink = Boolean(
      value.customer_id ||
        value.lead_id ||
        value.job_id ||
        value.quote_id ||
        value.invoice_id ||
        value.platform_conversation_id,
    );
    if (!hasLink) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customer_id"],
        message: "Link the promise to a customer, record, or AI conversation.",
      });
    }
  });

export const jobSchema = z.object({
  customer_id: z.string().uuid(),
  site_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  site_contact_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  lead_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  service_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  job_type_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  problem_description: z.string().optional().nullable(),
  affected_area: z.string().optional().nullable(),
  urgency_level: z.string().optional().nullable(),
  preferred_date_text: z.string().optional().nullable(),
  preferred_time_window: z.string().optional().nullable(),
  scheduled_date: z.string().optional().nullable(),
  scheduled_time: z.string().optional().nullable(),
  duration_hours: z.coerce.number().nonnegative().optional().nullable(),
  status: z.enum(jobStatuses),
  visit_classification: z.enum(visitClassifications).default("standard"),
  commercial_stage: z.enum(commercialStages).default("booked"),
  assigned_engineer: z.string().optional().nullable(),
  assigned_engineer_ids: z.preprocess(parseCheckboxIdList, z.array(z.string().uuid())).optional().default([]),
});

export const noteSchema = z.object({
  entity_type: z.enum(["customer", "job", "lead"]),
  entity_id: z.string().uuid(),
  body: z.string().min(2),
});

export const jobPhaseSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  status: z.enum(jobPhaseStatuses).default("planned"),
  sort_order: z.coerce.number().int().nonnegative().optional().nullable(),
  target_date: z.string().optional().nullable(),
});

export const jobVariationSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  estimated_value: z.coerce.number().nonnegative(),
  status: z.enum(jobVariationStatuses).default("draft"),
});

export const jobHazardSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  status: z.enum(jobHazardStatuses).default("active"),
});

export const jobChecklistSchema = z.object({
  title: z.string().min(2),
  notes: z.string().optional().nullable(),
  status: z.enum(jobChecklistStatuses).default("required"),
  is_mandatory: z.coerce.boolean().default(false),
});

export const jobSurveyAssessmentSchema = z.object({
  boiler_type: z.string().optional().nullable(),
  boiler_model: z.string().optional().nullable(),
  flue_route: z.string().optional().nullable(),
  gas_pipe_notes: z.string().optional().nullable(),
  condensate_notes: z.string().optional().nullable(),
  water_pressure_notes: z.string().optional().nullable(),
  radiator_notes: z.string().optional().nullable(),
  controls_notes: z.string().optional().nullable(),
  access_notes: z.string().optional().nullable(),
  parts_notes: z.string().optional().nullable(),
  risk_notes: z.string().optional().nullable(),
  engineer_notes: z.string().optional().nullable(),
  status: z.enum(["draft", "completed"]).default("draft"),
});

export const jobCoolingOffConsentSchema = z.object({
  applies: z.coerce.boolean().default(false),
  contract_channel: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  early_start_consent_at: z.string().optional().nullable(),
  consent_method: z.string().optional().nullable(),
  evidence_url: z.string().url().optional().or(z.literal("")).nullable(),
  notes: z.string().optional().nullable(),
});

export const jobComplianceCloseoutSchema = z.object({
  commissioning_complete: z.coerce.boolean().default(false),
  controls_handover_complete: z.coerce.boolean().default(false),
  building_regs_notification_due_at: z.string().optional().nullable(),
  building_regs_notified_at: z.string().optional().nullable(),
  gas_safe_reference: z.string().optional().nullable(),
  certificate_received_at: z.string().optional().nullable(),
  certificate_sent_at: z.string().optional().nullable(),
  evidence_url: z.string().url().optional().or(z.literal("")).nullable(),
  notes: z.string().optional().nullable(),
});

export const jobCertificateSchema = z.object({
  title: z.string().min(2),
  certificate_number: z.string().optional().nullable(),
  status: z.enum(jobCertificateStatuses).default("draft"),
  issued_at: z.string().optional().nullable(),
  file_url: z.string().optional().nullable(),
});

export const engineerAiAssistRequestSchema = z.object({
  action: z.enum(engineerAiAssistActions),
});

export const quoteSchema = z.object({
  job_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  document_type: z.enum(quoteDocumentTypes).default("quote"),
  line_items: z.array(lineItemSchema).min(1),
  vat_rate: z.coerce.number().min(0).max(1),
  vat_category: z.string().default("standard_20"),
  install_scope: z.record(z.string(), z.unknown()).optional().default({}),
  payment_terms: z.record(z.string(), z.unknown()).optional().default({}),
  agent_autonomy: z.record(z.string(), z.unknown()).optional().default({}),
  status: z.enum(quoteStatuses).default("draft"),
  valid_until: z.preprocess(emptyStringToNull, z.string().nullable()).optional(),
});

export const quoteAcceptanceSchema = z.object({
  accepted_by_name: z.string().min(2),
  accepted_by_email: z.string().email().optional().or(z.literal("")).nullable(),
  acceptance_method: z.string().min(2),
  acceptance_channel: z.string().optional().nullable(),
  evidence_url: z.string().url().optional().or(z.literal("")).nullable(),
  evidence_attachment_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  notes: z.string().optional().nullable(),
});

export const invoiceScheduleSchema = z.object({
  label: z.string().min(2),
  payment_type: z.enum(paymentTypes),
  percentage: z.coerce.number().min(0).max(100).optional().nullable(),
  fixed_amount: z.coerce.number().min(0).optional().nullable(),
  due_offset_days: z.coerce.number().int().min(0).default(14),
});

export const invoiceSchema = z.object({
  quote_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  job_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  invoice_kind: z.enum(invoiceKinds).default("standard"),
  invoice_schedule_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  balance_of_quote_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  line_items: z.array(lineItemSchema).min(1),
  vat_rate: z.coerce.number().min(0).max(1),
  vat_category: z.string().default("standard_20"),
  status: z.enum(invoiceStatuses).default("unpaid"),
  due_date: z.string().optional().nullable(),
});

export const expenseSchema = z.object({
  job_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  description: z.string().min(2),
  amount: z.coerce.number().nonnegative(),
  category: z.enum(expenseCategories),
  receipt_url: z.string().optional().nullable(),
});

export const paymentSchema = z.object({
  invoice_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  quote_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  customer_id: z.string().uuid(),
  payment_type: z.enum(paymentTypes),
  amount: z.coerce.number().positive(),
  status: z.enum(paymentStatuses).default("requested"),
  requested_at: z.string().optional().nullable(),
  received_at: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const appointmentSchema = z.object({
  customer_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  lead_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  job_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  assigned_to: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  type: z.enum(appointmentTypes),
  title: z.string().min(2),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  status: z.enum(appointmentStatuses).default("scheduled"),
  confirmation_email_sent_at: z.string().optional().nullable(),
  confirmation_sms_sent_at: z.string().optional().nullable(),
  notification_status: z.string().optional().nullable(),
  notification_failure_reason: z.string().optional().nullable(),
  reminder_offset_minutes: z.coerce.number().optional().nullable(),
  recurrence_rule: z.string().optional().nullable(),
});

export const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(2),
  name: z.string().min(2),
  active: z.coerce.boolean().default(true),
  launch_date: z.string().optional().nullable(),
  ai_visible: z.coerce.boolean().default(true),
  ai_bookable: z.coerce.boolean().default(true),
  ai_price_enabled: z.coerce.boolean().default(false),
  ai_requires_office_quote: z.coerce.boolean().default(true),
  ai_default_duration_minutes: z
    .preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().positive().nullable())
    .optional(),
  ai_price_disclaimer: z.string().optional().nullable(),
});

export const jobTypeSchema = z.object({
  id: z.string().uuid().optional(),
  service_id: z.string().uuid(),
  slug: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  active: z.coerce.boolean().default(true),
  ai_visible: z.coerce.boolean().default(true),
  ai_bookable: z.coerce.boolean().default(true),
  ai_default_duration_minutes: z
    .preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().positive().nullable())
    .optional(),
});

export const aiCatalogSettingsSchema = z.object({
  trade_vertical: z.enum(tradeVerticals).default("general_trades"),
  ai_catalog_default_duration_minutes: z.coerce.number().int().positive().default(60),
  ai_catalog_emergency_duration_minutes: z.coerce.number().int().positive().default(120),
  ai_catalog_can_give_fixed_prices: z.coerce.boolean().default(false),
  ai_catalog_can_give_from_prices: z.coerce.boolean().default(true),
  ai_catalog_requires_office_quote_for_installations: z.coerce.boolean().default(true),
  ai_catalog_price_disclaimer: z.string().min(10).default("The office confirms final pricing before work starts."),
  ai_catalog_emergency_escalation_text: z.string().min(10).default("If there is an immediate risk, call the emergency services."),
  ai_catalog_gas_safety_text: z.string().optional().nullable(),
  ai_catalog_electrical_safety_text: z.string().optional().nullable(),
});

export const customFieldDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  entity_type: z.enum(supportedEntityTypes),
  service_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  job_type_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  field_key: z.string().min(2),
  label: z.string().min(2),
  field_type: z.enum(customFieldTypes),
  options: z.array(z.string()).optional().nullable(),
  required: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().nonnegative().default(0),
});

export const requiredDocumentRuleSchema = z.object({
  id: z.string().uuid().optional(),
  entity_type: z.enum(["lead", "job", "asset"]),
  service_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  job_type_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  pipeline_stage: z.string().optional().nullable(),
  document_type: z.string().min(2),
  required: z.coerce.boolean().default(true),
  due_within_days: z.coerce.number().int().optional().nullable(),
  active: z.coerce.boolean().default(true),
});

export const customFieldValueSchema = z.object({
  field_definition_id: z.string().uuid(),
  entity_type: z.enum(supportedEntityTypes),
  entity_id: z.string().uuid(),
  value_json: z.unknown(),
});

export const userCertificationSchema = z.object({
  user_profile_id: z.string().uuid(),
  title: z.string().min(2),
  category: z.enum(certificationCategories),
  issuer: z.string().optional().nullable(),
  issue_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  reminder_days_before: z.coerce.number().int().nonnegative().default(30),
  file_url: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  category: z.string().optional().nullable(),
  contact_name: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  pricing_last_updated_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const purchaseOrderSchema = z.object({
  supplier_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  po_number: z.string().min(2),
  status: z.enum(purchaseOrderStatuses).default("draft"),
  total_amount: z.coerce.number().nonnegative(),
  notes: z.string().optional().nullable(),
  issued_at: z.string().optional().nullable(),
});

export const supplierReconciliationSchema = z.object({
  purchase_order_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  supplier_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  entry_type: z.enum(supplierReconciliationEntryTypes),
  reference_number: z.string().optional().nullable(),
  amount: z.coerce.number(),
  status: z.enum(supplierReconciliationStatuses).default("open"),
});

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  service_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  supplier_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  category: z.string().optional().nullable(),
  name: z.string().min(2),
  sku: z.string().optional().nullable(),
  unit_cost: z.coerce.number().nonnegative().default(0),
  markup_percent: z.coerce.number().optional().nullable(),
  sell_price: z.coerce.number().nonnegative(),
  vat_category: z.string().default("standard_20"),
  active: z.coerce.boolean().default(true),
});

export const quoteTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  service_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  job_type_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  line_items: z.array(lineItemSchema).default([]),
  optional_extras: z.array(lineItemSchema).default([]),
  payment_terms: z.record(z.string(), z.unknown()).optional().nullable(),
  active: z.coerce.boolean().default(true),
});
