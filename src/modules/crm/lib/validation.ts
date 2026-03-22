import { z } from "zod";
import { appointmentStatuses, appointmentTypes, certificationCategories, customFieldTypes, expenseCategories, invoiceStatuses, jobStatuses, leadStatuses, paymentStatuses, paymentTypes, quoteStatuses, supportedEntityTypes } from "@/modules/crm/types";

export const lineItemSchema = z.object({
  description: z.string().min(2),
  qty: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative(),
});

export const customerSchema = z.object({
  full_name: z.string().min(2),
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
  archived: z.coerce.boolean().optional().default(false),
});

export const leadSchema = z.object({
  customer_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  service_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  job_type_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  status: z.enum(leadStatuses),
  lost_reason: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().or(z.literal("")).nullable(),
  next_action_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const jobSchema = z.object({
  customer_id: z.string().uuid(),
  lead_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  service_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  job_type_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  scheduled_date: z.string().optional().nullable(),
  scheduled_time: z.string().optional().nullable(),
  duration_hours: z.coerce.number().nonnegative().optional().nullable(),
  status: z.enum(jobStatuses),
  assigned_engineer: z.string().optional().nullable(),
});

export const noteSchema = z.object({
  entity_type: z.enum(["customer", "job", "lead"]),
  entity_id: z.string().uuid(),
  body: z.string().min(2),
});

export const quoteSchema = z.object({
  job_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  line_items: z.array(lineItemSchema).min(1),
  vat_rate: z.coerce.number().min(0).max(1),
  vat_category: z.string().default("standard_20"),
  status: z.enum(quoteStatuses).default("draft"),
  valid_until: z.string().optional().nullable(),
});

export const invoiceSchema = z.object({
  quote_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  job_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  line_items: z.array(lineItemSchema).min(1),
  vat_rate: z.coerce.number().min(0).max(1),
  vat_category: z.string().default("standard_20"),
  status: z.enum(invoiceStatuses).default("unpaid"),
  due_date: z.string().optional().nullable(),
});

export const expenseSchema = z.object({
  job_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  description: z.string().min(2),
  amount: z.coerce.number().nonnegative(),
  category: z.enum(expenseCategories),
  receipt_url: z.string().optional().nullable(),
});

export const paymentSchema = z.object({
  invoice_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  quote_id: z.string().uuid().optional().or(z.literal("")).nullable(),
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
  customer_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  lead_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  job_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  assigned_to: z.string().uuid().optional().or(z.literal("")).nullable(),
  type: z.enum(appointmentTypes),
  title: z.string().min(2),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  status: z.enum(appointmentStatuses).default("scheduled"),
  reminder_offset_minutes: z.coerce.number().optional().nullable(),
  recurrence_rule: z.string().optional().nullable(),
});

export const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(2),
  name: z.string().min(2),
  active: z.coerce.boolean().default(true),
  launch_date: z.string().optional().nullable(),
});

export const jobTypeSchema = z.object({
  id: z.string().uuid().optional(),
  service_id: z.string().uuid(),
  slug: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  active: z.coerce.boolean().default(true),
});

export const customFieldDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  entity_type: z.enum(supportedEntityTypes),
  service_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  job_type_id: z.string().uuid().optional().or(z.literal("")).nullable(),
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
  service_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  job_type_id: z.string().uuid().optional().or(z.literal("")).nullable(),
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

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  supplier_id: z.string().uuid().optional().or(z.literal("")).nullable(),
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
  service_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  job_type_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  line_items: z.array(lineItemSchema).default([]),
  optional_extras: z.array(lineItemSchema).default([]),
  payment_terms: z.record(z.string(), z.unknown()).optional().nullable(),
  active: z.coerce.boolean().default(true),
});
