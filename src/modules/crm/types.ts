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

export const jobStatuses = ["enquiry", "booked", "in_progress", "completed", "invoiced"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const quoteStatuses = ["draft", "sent", "accepted", "declined"] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const invoiceStatuses = ["unpaid", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const paymentStatuses = ["requested", "received", "failed", "refunded"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentTypes = ["deposit", "stage", "final", "finance"] as const;
export type PaymentType = (typeof paymentTypes)[number];

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

export type StatusBadgeConfig = {
  label: string;
  className: string;
};

export type UserProfile = {
  id: string;
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
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  customer_id: string;
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
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  entity_type: "customer" | "job" | "lead";
  entity_id: string;
  body: string;
  created_by: string | null;
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
  line_items: LineItem[];
  subtotal: number;
  vat_rate: number;
  vat_category: string;
  total: number;
  status: QuoteStatus;
  valid_until: string | null;
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
  created_at: string;
};

export type Expense = {
  id: string;
  job_id: string | null;
  description: string;
  amount: number;
  category: ExpenseCategory;
  receipt_url: string | null;
  created_by: string | null;
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

export type CustomerWithCounts = Customer & {
  job_count: number;
  active_job_count: number;
};

export type LeadWithRelations = Lead & {
  customer?: Pick<Customer, "id" | "full_name" | "phone" | "postcode"> | null;
  service?: Pick<Service, "id" | "name"> | null;
  job_type?: Pick<JobType, "id" | "name"> | null;
  owner?: Pick<UserProfile, "id" | "full_name" | "role"> | null;
};

export type JobWithRelations = Job & {
  customer?: Pick<Customer, "id" | "full_name" | "phone" | "postcode"> | null;
  service?: Pick<Service, "id" | "name"> | null;
  job_type?: Pick<JobType, "id" | "name"> | null;
};

export type QuoteWithRelations = Quote & {
  customer?: Pick<Customer, "id" | "full_name" | "address_line1" | "postcode" | "phone"> | null;
  job?: Pick<Job, "id" | "title"> | null;
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
