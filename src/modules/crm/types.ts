export const crmRoles = ["management", "admin", "sales", "engineer", "accounts"] as const;
export type CrmRole = (typeof crmRoles)[number];

export const leadStatuses = [
  "new",
  "contacted",
  "follow_up",
  "survey_booked",
  "quoted",
  "accepted",
  "booked",
  "completed",
  "lost",
] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const leadCustomerMatchResults = ["matched", "new", "possible_duplicate"] as const;
export type LeadCustomerMatchResult = (typeof leadCustomerMatchResults)[number];

export const leadDedupeResults = ["created", "updated_existing"] as const;
export type LeadDedupeResult = (typeof leadDedupeResults)[number];

export const jobStatuses = ["enquiry", "booked", "in_progress", "completed", "invoiced"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const jobPhaseStatuses = ["planned", "ready", "in_progress", "completed"] as const;
export type JobPhaseStatus = (typeof jobPhaseStatuses)[number];

export const jobVariationStatuses = ["draft", "approved", "declined", "invoiced"] as const;
export type JobVariationStatus = (typeof jobVariationStatuses)[number];

export const quoteStatuses = ["draft", "sent", "accepted", "declined"] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteDocumentTypes = ["quote", "estimate"] as const;
export type QuoteDocumentType = (typeof quoteDocumentTypes)[number];

export const invoiceStatuses = ["unpaid", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const paymentStatuses = ["requested", "received", "failed", "refunded"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentTypes = ["deposit", "stage", "final", "finance"] as const;
export type PaymentType = (typeof paymentTypes)[number];

export const invoiceScheduleStatuses = ["planned", "invoiced", "paid"] as const;
export type InvoiceScheduleStatus = (typeof invoiceScheduleStatuses)[number];

export const jobHazardStatuses = ["active", "mitigated", "hazard_free"] as const;
export type JobHazardStatus = (typeof jobHazardStatuses)[number];

export const jobChecklistStatuses = ["required", "completed"] as const;
export type JobChecklistStatus = (typeof jobChecklistStatuses)[number];

export const jobCertificateStatuses = ["draft", "completed", "sent"] as const;
export type JobCertificateStatus = (typeof jobCertificateStatuses)[number];

export const purchaseOrderStatuses = ["draft", "issued", "received", "reconciled"] as const;
export type PurchaseOrderStatus = (typeof purchaseOrderStatuses)[number];

export const supplierReconciliationStatuses = ["open", "reconciled"] as const;
export type SupplierReconciliationStatus = (typeof supplierReconciliationStatuses)[number];

export const supplierReconciliationEntryTypes = ["invoice", "credit"] as const;
export type SupplierReconciliationEntryType = (typeof supplierReconciliationEntryTypes)[number];

export const expenseCategories = ["materials", "travel", "subcontractor", "other"] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export const appointmentTypes = ["call", "follow_up", "survey", "booking", "meeting", "reminder"] as const;
export type AppointmentType = (typeof appointmentTypes)[number];

export const appointmentStatuses = ["scheduled", "completed", "cancelled"] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const customFieldTypes = ["text", "textarea", "number", "select", "multiselect", "date", "boolean", "file"] as const;
export type CustomFieldType = (typeof customFieldTypes)[number];

export const supportedEntityTypes = ["lead", "customer", "asset", "job", "quote", "invoice"] as const;
export type SupportedEntityType = (typeof supportedEntityTypes)[number];

export const certificationCategories = ["qualification", "id", "compliance", "training"] as const;
export type CertificationCategory = (typeof certificationCategories)[number];

export const crmAddonKeys = ["ai_comms_hub"] as const;
export type CrmAddonKey = (typeof crmAddonKeys)[number];

export const tenantStatuses = ["trial", "active", "suspended", "archived"] as const;
export type TenantStatus = (typeof tenantStatuses)[number];

export const engineerAiAssistActions = [
  "summary",
  "arrival_note_draft",
  "completion_note_draft",
  "customer_update_draft",
  "missing_evidence_check",
] as const;
export type EngineerAiAssistAction = (typeof engineerAiAssistActions)[number];
export type EngineerAiAssistState = "locked" | "demo" | "enabled";

export const aiConversationChannels = ["sms", "whatsapp", "web_chat", "voice"] as const;
export type AiConversationChannel = (typeof aiConversationChannels)[number];

export const aiAgentTypes = ["triage", "qualification", "booking", "faq", "escalation"] as const;
export type AiAgentType = (typeof aiAgentTypes)[number];

export const aiMessageRoles = ["customer", "assistant", "system"] as const;
export type AiMessageRole = (typeof aiMessageRoles)[number];

export type StatusBadgeConfig = {
  label: string;
  className: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
};

export type TenantBranding = {
  id: string;
  tenant_id: string;
  business_name: string;
  crm_display_name: string | null;
  primary_phone: string | null;
  support_email: string | null;
  website_url: string | null;
  logo_url: string | null;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantSettings = {
  id: string;
  tenant_id: string;
  legal_name: string | null;
  vat_registration_number: string | null;
  gas_safe_number: string | null;
  invoice_footer: string | null;
  quote_footer: string | null;
  certificate_footer: string | null;
  default_payment_terms: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TenantMembership = {
  id: string;
  tenant_id: string;
  user_id: string;
  role: CrmRole;
  active: boolean;
  is_owner: boolean;
  is_demo: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
  updated_at: string;
  tenant?: Tenant | null;
};

export type UserProfile = {
  id: string;
  tenant_id: string;
  user_id: string;
  role: CrmRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  emergency_contact: string | null;
  agreed_hours: string | null;
  pay_type: string | null;
  pay_notes: string | null;
  contract_file_url: string | null;
  active: boolean;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
  updated_at: string;
};

export type UserCertification = {
  id: string;
  user_profile_id: string;
  title: string;
  category: CertificationCategory;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  reminder_days_before: number;
  file_url: string | null;
  notes: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type Service = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  launch_date: string | null;
  created_at: string;
};

export type JobType = {
  id: string;
  service_id: string;
  slug: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

export type Lead = {
  id: string;
  customer_id: string | null;
  service_id: string | null;
  job_type_id: string | null;
  status: LeadStatus;
  lost_reason: string | null;
  source: string | null;
  assigned_to: string | null;
  next_action_at: string | null;
  notes: string | null;
  intake_source: string | null;
  submission_fingerprint: string | null;
  submission_count: number;
  first_submitted_at: string | null;
  last_submitted_at: string | null;
  possible_duplicate_customer_id: string | null;
  matched_customer_confidence: string | null;
  customer_match_result: LeadCustomerMatchResult | null;
  dedupe_result: LeadDedupeResult | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  property_type: string | null;
  occupancy_type: string | null;
  source: string | null;
  referral_notes: string | null;
  notes: string | null;
  archived: boolean;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
  updated_at: string;
};

export type CustomerAsset = {
  id: string;
  customer_id: string;
  service_id: string | null;
  asset_type: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  service_due_date: string | null;
  warranty_end_date: string | null;
  cylinder_type: string | null;
  notes: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
  updated_at: string;
};

export type Site = {
  id: string;
  tenant_id: string;
  customer_id: string;
  label: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  access_notes: string | null;
  parking_notes: string | null;
  is_primary: boolean;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
  updated_at: string;
};

export type SiteContact = {
  id: string;
  tenant_id: string;
  site_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role_label: string | null;
  is_primary: boolean;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  customer_id: string;
  site_id: string | null;
  site_contact_id: string | null;
  lead_id: string | null;
  service_id: string | null;
  job_type_id: string | null;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_hours: number | null;
  status: JobStatus;
  assigned_engineer: string | null;
  created_by: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
  updated_at: string;
};

export type JobAssignee = {
  id: string;
  tenant_id: string;
  job_id: string;
  user_profile_id: string;
  assignment_role: string | null;
  created_at: string;
  user_profile?: Pick<UserProfile, "id" | "full_name" | "role" | "user_id"> | null;
};

export type JobPhase = {
  id: string;
  tenant_id: string;
  job_id: string;
  name: string;
  description: string | null;
  status: JobPhaseStatus;
  sort_order: number;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobVariation = {
  id: string;
  tenant_id: string;
  job_id: string;
  title: string;
  description: string | null;
  estimated_value: number;
  status: JobVariationStatus;
  created_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobHazard = {
  id: string;
  tenant_id: string;
  job_id: string;
  title: string;
  description: string | null;
  status: JobHazardStatus;
  created_at: string;
  updated_at: string;
};

export type JobChecklist = {
  id: string;
  tenant_id: string;
  job_id: string;
  title: string;
  notes: string | null;
  status: JobChecklistStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobCertificate = {
  id: string;
  tenant_id: string;
  job_id: string;
  title: string;
  certificate_number: string | null;
  status: JobCertificateStatus;
  issued_at: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  entity_type: "customer" | "job" | "lead";
  entity_id: string;
  body: string;
  created_by: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  customer_id: string | null;
  lead_id: string | null;
  job_id: string | null;
  assigned_to: string | null;
  type: AppointmentType;
  title: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  reminder_offset_minutes: number | null;
  recurrence_rule: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type LineItem = {
  description: string;
  qty: number;
  unit_price: number;
};

export type Quote = {
  id: string;
  job_id: string;
  customer_id: string;
  quote_number: string;
  document_type: QuoteDocumentType;
  current_version_number: number;
  line_items: LineItem[];
  subtotal: number;
  vat_rate: number;
  vat_category: string;
  total: number;
  status: QuoteStatus;
  valid_until: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type QuoteVersion = {
  id: string;
  tenant_id: string;
  quote_id: string;
  version_number: number;
  document_type: QuoteDocumentType;
  line_items: LineItem[];
  subtotal: number;
  vat_rate: number;
  vat_category: string;
  total: number;
  valid_until: string | null;
  status: QuoteStatus;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
};

export type QuoteAcceptance = {
  id: string;
  tenant_id: string;
  quote_id: string;
  accepted_by_name: string;
  accepted_by_email: string | null;
  acceptance_method: string;
  notes: string | null;
  accepted_at: string;
  created_at: string;
};

export type Invoice = {
  id: string;
  quote_id: string | null;
  job_id: string;
  customer_id: string;
  invoice_number: string;
  line_items: LineItem[];
  subtotal: number;
  vat_rate: number;
  vat_category: string;
  total: number;
  status: InvoiceStatus;
  due_date: string | null;
  paid_at: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type Payment = {
  id: string;
  invoice_id: string | null;
  quote_id: string | null;
  customer_id: string;
  payment_type: PaymentType;
  amount: number;
  status: PaymentStatus;
  requested_at: string | null;
  received_at: string | null;
  reference: string | null;
  notes: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type InvoiceSchedule = {
  id: string;
  tenant_id: string;
  quote_id: string;
  label: string;
  payment_type: PaymentType;
  percentage: number | null;
  fixed_amount: number | null;
  due_offset_days: number;
  status: InvoiceScheduleStatus;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrder = {
  id: string;
  tenant_id: string;
  job_id: string;
  supplier_id: string | null;
  po_number: string;
  status: PurchaseOrderStatus;
  total_amount: number;
  notes: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Pick<Supplier, "id" | "name"> | null;
};

export type SupplierReconciliation = {
  id: string;
  tenant_id: string;
  job_id: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  entry_type: SupplierReconciliationEntryType;
  reference_number: string | null;
  amount: number;
  status: SupplierReconciliationStatus;
  created_at: string;
  updated_at: string;
  supplier?: Pick<Supplier, "id" | "name"> | null;
};

export type Expense = {
  id: string;
  job_id: string | null;
  description: string;
  amount: number;
  category: ExpenseCategory;
  receipt_url: string | null;
  created_by: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type Attachment = {
  id: string;
  entity_type: SupportedEntityType | "payment";
  entity_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  created_by: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type CustomFieldDefinition = {
  id: string;
  entity_type: SupportedEntityType;
  service_id: string | null;
  job_type_id: string | null;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[] | null;
  required: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  category: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  pricing_last_updated_at: string | null;
  notes: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type Product = {
  id: string;
  service_id: string | null;
  supplier_id: string | null;
  category: string | null;
  name: string;
  sku: string | null;
  unit_cost: number;
  markup_percent: number | null;
  sell_price: number;
  vat_category: string;
  active: boolean;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  updated_at: string;
};

export type QuoteTemplate = {
  id: string;
  service_id: string | null;
  job_type_id: string | null;
  name: string;
  description: string | null;
  line_items: LineItem[];
  optional_extras: LineItem[];
  payment_terms: Record<string, unknown> | null;
  active: boolean;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type AddonState = {
  id?: string;
  addon_key: CrmAddonKey;
  enabled: boolean;
  demo_enabled: boolean;
  display_name: string;
  price_label: string;
  cta_url: string | null;
  summary: string;
  created_at?: string;
  updated_at?: string;
};

export type AiRoiMetrics = {
  missed_calls_recovered: number;
  bookings_captured: number;
  leads_qualified: number;
  average_response_minutes: number;
};

export type AiScenario = {
  id: string;
  scenario_key: string;
  title: string;
  subtitle: string | null;
  channel: AiConversationChannel;
  customer_name: string;
  customer_handle: string;
  inbound_label: string;
  summary: string;
  final_outcome: string;
  roi_metrics: AiRoiMetrics;
  extracted_entities: Record<string, string>;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  sort_order: number;
  offset_seconds: number;
  role: AiMessageRole;
  sender_label: string;
  body: string;
  channel: AiConversationChannel | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type AiAgentAction = {
  id: string;
  conversation_id: string;
  sort_order: number;
  offset_seconds: number;
  agent_type: AiAgentType;
  title: string;
  detail: string;
  status_label: string;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type AiCrmImpact = {
  id: string;
  conversation_id: string;
  sort_order: number;
  offset_seconds: number;
  impact_type: string;
  title: string;
  detail: string;
  crm_entity_type: "lead" | "customer" | "appointment" | "job" | "quote" | "invoice" | null;
  crm_entity_id: string | null;
  route_path: string | null;
  is_demo?: boolean;
  demo_scenario_key?: "core-walkthrough" | null;
  created_at: string;
};

export type AiConversation = AiScenario & {
  messages: AiMessage[];
  actions: AiAgentAction[];
  impacts: AiCrmImpact[];
};

export type EngineerAiAssistDraft = {
  action: EngineerAiAssistAction;
  title: string;
  summary: string;
  body: string;
  note_body: string | null;
  checks: string[];
};

export type CustomFieldValue = {
  id: string;
  field_definition_id: string;
  entity_type: SupportedEntityType;
  entity_id: string;
  value_json: unknown;
  created_at: string;
  updated_at: string;
};

export type RequiredDocumentRule = {
  id: string;
  entity_type: "lead" | "job" | "asset";
  service_id: string | null;
  job_type_id: string | null;
  pipeline_stage: string | null;
  document_type: string;
  required: boolean;
  due_within_days: number | null;
  active: boolean;
  created_at: string;
};

export type CalendarItem = Appointment & {
  source: "appointment" | "lead_follow_up" | "service_due" | "warranty_expiry";
  customer?: Pick<Customer, "id" | "full_name" | "postcode"> | null;
  lead?: Pick<Lead, "id" | "status" | "source"> | null;
  owner?: Pick<UserProfile, "id" | "full_name" | "role"> | null;
  recurrence_origin_id?: string | null;
  entity_link?: string | null;
  synthetic?: boolean;
};

export type StaffDirectoryEntry = UserProfile & {
  certifications: UserCertification[];
};

export type ReportsSummary = {
  totalRevenue: number;
  unpaidRevenue: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  leadCount: number;
  convertedLeadCount: number;
  jobCount: number;
  completedJobCount: number;
  totalExpenses: number;
  profitEstimate: number;
  engineerWorkload: Array<{
    engineer: string;
    totalJobs: number;
    completedJobs: number;
    openJobs: number;
  }>;
};

export type CustomerWithCounts = Customer & {
  job_count: number;
  active_job_count: number;
};

export type LeadWithRelations = Lead & {
  customer?: Pick<Customer, "id" | "full_name" | "phone" | "email" | "address_line1" | "postcode"> | null;
  service?: Pick<Service, "id" | "name"> | null;
  job_type?: Pick<JobType, "id" | "name"> | null;
  owner?: Pick<UserProfile, "id" | "full_name" | "role"> | null;
  possible_duplicate_customer?: Pick<Customer, "id" | "full_name" | "phone" | "email"> | null;
};

export type JobWithRelations = Job & {
  customer?: Pick<Customer, "id" | "full_name" | "phone" | "address_line1" | "postcode"> | null;
  site?: Pick<Site, "id" | "label" | "address_line1" | "postcode" | "city" | "access_notes" | "parking_notes"> | null;
  site_contact?: Pick<SiteContact, "id" | "full_name" | "phone" | "email" | "role_label"> | null;
  service?: Pick<Service, "id" | "name"> | null;
  job_type?: Pick<JobType, "id" | "name"> | null;
  assignees?: JobAssignee[];
  phases?: JobPhase[];
  variations?: JobVariation[];
  hazards?: JobHazard[];
  checklists?: JobChecklist[];
  certificates?: JobCertificate[];
  purchaseOrders?: PurchaseOrder[];
  supplierReconciliation?: SupplierReconciliation[];
};

export type QuoteWithRelations = Quote & {
  customer?: Pick<Customer, "id" | "full_name" | "address_line1" | "postcode" | "phone"> | null;
  job?: Pick<Job, "id" | "title"> | null;
  versions?: QuoteVersion[];
  acceptance?: QuoteAcceptance | null;
  invoiceSchedules?: InvoiceSchedule[];
};

export type InvoiceWithRelations = Invoice & {
  customer?: Pick<Customer, "id" | "full_name" | "address_line1" | "postcode" | "phone"> | null;
  job?: Pick<Job, "id" | "title"> | null;
};

export type DashboardData = {
  openJobsCount: number;
  todaysJobs: JobWithRelations[];
  unpaidInvoicesTotal: number;
  newLeadCount: number;
  recentCustomers: Customer[];
  activeJobs: JobWithRelations[];
};

export type EngineerDashboardJob = JobWithRelations & {
  latestNote: Pick<Note, "body" | "created_at"> | null;
  attachmentCount: number;
  hasQuote: boolean;
  hasInvoice: boolean;
  missingNote: boolean;
  missingPhoto: boolean;
  missingRequiredDocument: boolean;
  overdue: boolean;
};

export type EngineerFieldTaskCounts = {
  missingNotes: number;
  missingPhotos: number;
  missingRequiredDocuments: number;
  overdueJobs: number;
};

export type EngineerDashboardData = {
  nextAssignedJob: EngineerDashboardJob | null;
  todaysAssignedJobs: EngineerDashboardJob[];
  overdueAssignedJobs: EngineerDashboardJob[];
  readyJobs: EngineerDashboardJob[];
  upcomingAssignedJobs: EngineerDashboardJob[];
  fieldTaskCounts: EngineerFieldTaskCounts;
};
