/**
 * Self-contained "Try Empire CRM" demo — entity types.
 *
 * This module is deliberately ISOLATED: it must never import the real CRM data
 * layer, Supabase, platform-event posting, or Twilio. All data here is fictional
 * and held in memory only. See tests/unit/demo-crm-isolation.test.ts.
 */

export type DemoAgentId = "voice" | "lead" | "messaging" | "web_chat" | "payments";

export type DemoChannel = "voice" | "sms" | "whatsapp" | "web_chat" | "web_form" | "email";

export type DemoLeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "survey_booked"
  | "quoted"
  | "booked"
  | "completed"
  | "lost";

export type DemoAppointmentType = "callout" | "survey" | "service" | "install";
export type DemoAppointmentStatus = "scheduled" | "completed";
export type DemoJobStatus = "booked" | "in_progress" | "completed" | "invoiced";
export type DemoQuoteStatus = "draft" | "sent" | "accepted" | "declined";
export type DemoInvoiceStatus = "unpaid" | "overdue" | "paid" | "void";

export type DemoEngineer = {
  id: string;
  name: string;
  initials: string;
  trade: string;
};

export type DemoCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  addressLine: string;
  postcode: string;
};

export type DemoLead = {
  id: string;
  customerName: string;
  phone: string;
  source: DemoChannel;
  agent: DemoAgentId | null;
  service: string;
  problem: string;
  urgency: "emergency" | "soon" | "routine";
  status: DemoLeadStatus;
  createdAt: string; // ISO
  notes?: string;
};

export type DemoAppointment = {
  id: string;
  leadId: string | null;
  customerName: string;
  type: DemoAppointmentType;
  engineerId: string | null;
  start: string; // ISO
  durationMins: number;
  status: DemoAppointmentStatus;
  addressLine: string;
  postcode: string;
};

export type DemoJob = {
  id: string;
  ref: string;
  customerName: string;
  service: string;
  status: DemoJobStatus;
  engineerId: string | null;
  appointmentId: string | null;
  valueGbp: number;
};

export type DemoQuote = {
  id: string;
  ref: string;
  customerName: string;
  service: string;
  totalGbp: number;
  status: DemoQuoteStatus;
};

export type DemoInvoice = {
  id: string;
  ref: string;
  customerName: string;
  jobRef: string;
  amountGbp: number;
  status: DemoInvoiceStatus;
  dueDate: string; // ISO date
};

export type DemoMessage = {
  role: "customer" | "agent" | "system";
  channel: DemoChannel;
  text: string;
};

export type DemoActivityItem = {
  id: string;
  at: string; // ISO
  agent: DemoAgentId | null;
  text: string;
};

export type DemoCrmState = {
  customers: DemoCustomer[];
  leads: DemoLead[];
  appointments: DemoAppointment[];
  jobs: DemoJob[];
  quotes: DemoQuote[];
  invoices: DemoInvoice[];
  engineers: DemoEngineer[];
  /** Transcript per agent, populated as the user runs each agent. */
  conversations: Record<DemoAgentId, DemoMessage[]>;
  /** Reverse-chronological feed shown in the dashboard / inbox. */
  activity: DemoActivityItem[];
};

/**
 * What running an agent produces in the CRM. Templates are cloned and given
 * fresh ids at apply time so repeated runs add distinct rows.
 */
export type DemoAgentOutcome = {
  leads?: Omit<DemoLead, "id" | "createdAt">[];
  appointments?: Omit<DemoAppointment, "id" | "leadId">[];
  jobs?: Omit<DemoJob, "id">[];
  quotes?: Omit<DemoQuote, "id">[];
  /** Mark an existing seeded invoice (by ref) as paid — used by the Payments agent. */
  payInvoiceRef?: string;
  activity: string;
};
