export type JobStatus = 'enquiry' | 'booked' | 'in_progress' | 'completed' | 'invoiced'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined'
export type InvoiceStatus = 'unpaid' | 'paid' | 'overdue' | 'void'
export type ExpenseCategory = 'materials' | 'travel' | 'subcontractor' | 'other'

export interface Customer {
  id: string
  full_name: string
  phone: string
  email: string
  address_line1: string
  city: string
  postcode: string
  notes: string
  archived: boolean
  created_at: string
}

export interface Job {
  id: string
  customer_id: string
  title: string
  description: string
  scheduled_date: string
  scheduled_time: string
  status: JobStatus
  assigned_engineer: string
  created_at: string
}

export interface Note {
  id: string
  entity_type: 'customer' | 'job'
  entity_id: string
  body: string
  created_by: string
  created_at: string
}

export interface LineItem {
  description: string
  qty: number
  unit_price: number
}

export interface Quote {
  id: string
  job_id: string
  customer_id: string
  quote_number: string
  document_type: 'quote' | 'estimate'
  current_version_number: number
  line_items: LineItem[]
  subtotal: number
  vat_rate: number
  vat_category: string
  total: number
  status: QuoteStatus
  valid_until: string
  created_at: string
}

export interface Invoice {
  id: string
  quote_id: string | null
  job_id: string
  customer_id: string
  invoice_number: string
  line_items: LineItem[]
  subtotal: number
  vat_rate: number
  vat_category: string
  total: number
  status: InvoiceStatus
  due_date: string
  paid_at: string | null
  created_at: string
}

export interface Expense {
  id: string
  job_id: string
  description: string
  amount: number
  category: ExpenseCategory
  created_by: string
  created_at: string
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

export const customers: Customer[] = [
  {
    id: 'c1',
    full_name: 'David Okafor',
    phone: '07712 345 678',
    email: 'david.okafor@email.com',
    address_line1: '14 Cowley Road',
    city: 'Uxbridge',
    postcode: 'UB8 2LQ',
    notes: 'Prefers morning appointments. Has a combi boiler (Worcester 30CDi).',
    archived: false,
    created_at: '2026-01-10T09:00:00Z',
  },
  {
    id: 'c2',
    full_name: 'Priya Sharma',
    phone: '07890 123 456',
    email: 'priya.sharma@gmail.com',
    address_line1: '7 Botwell Lane',
    city: 'Hayes',
    postcode: 'UB3 2AB',
    notes: 'Rental property — landlord contact. Tenant is Marcos Fernandes.',
    archived: false,
    created_at: '2026-01-18T11:30:00Z',
  },
  {
    id: 'c3',
    full_name: 'James Whitfield',
    phone: '07654 987 321',
    email: 'j.whitfield@hotmail.co.uk',
    address_line1: '32 Almond Avenue',
    city: 'Slough',
    postcode: 'SL1 4TY',
    notes: 'Elderly customer — needs patient explanation. Son sometimes present.',
    archived: false,
    created_at: '2026-01-25T14:00:00Z',
  },
  {
    id: 'c4',
    full_name: 'Fatima Al-Rashid',
    phone: '07321 654 098',
    email: 'fatima.alrashid@outlook.com',
    address_line1: '89 Station Road',
    city: 'Harrow',
    postcode: 'HA1 2SB',
    notes: 'New boiler installation enquiry. Currently has old Vaillant system.',
    archived: false,
    created_at: '2026-02-03T10:15:00Z',
  },
  {
    id: 'c5',
    full_name: 'Tom Brennan',
    phone: '07555 222 999',
    email: 'tombrennan@icloud.com',
    address_line1: '5 Chestnut Drive',
    city: 'Ruislip',
    postcode: 'HA4 7TF',
    notes: 'Power flush job completed. Follow up for annual service.',
    archived: false,
    created_at: '2026-02-10T16:00:00Z',
  },
]

// ─── JOBS ─────────────────────────────────────────────────────────────────────

export const jobs: Job[] = [
  {
    id: 'j1',
    customer_id: 'c1',
    title: 'Boiler Repair — No Hot Water',
    description: 'Customer reports no hot water since yesterday. Boiler showing error code E119. Likely pressure sensor or diverter valve fault.',
    scheduled_date: '2026-02-19',
    scheduled_time: '09:00',
    status: 'in_progress',
    assigned_engineer: 'Shane',
    created_at: '2026-02-17T08:00:00Z',
  },
  {
    id: 'j2',
    customer_id: 'c2',
    title: 'Annual Boiler Service',
    description: 'Landlord gas safety certificate required. Vaillant EcoTec Plus 831.',
    scheduled_date: '2026-02-20',
    scheduled_time: '10:30',
    status: 'booked',
    assigned_engineer: 'Shaz',
    created_at: '2026-02-15T10:00:00Z',
  },
  {
    id: 'j3',
    customer_id: 'c3',
    title: 'Power Flush',
    description: 'System has sludge buildup — radiators cold at bottom. 10-rad system. Customer aware of 1-day job.',
    scheduled_date: '2026-02-18',
    scheduled_time: '08:00',
    status: 'completed',
    assigned_engineer: 'Shane',
    created_at: '2026-02-10T12:00:00Z',
  },
  {
    id: 'j4',
    customer_id: 'c4',
    title: 'New Boiler Installation — Worcester 4000',
    description: 'Full combi replacement. Old back boiler removal. 3-bed semi. Customer selected Worcester Bosch 4000 30kW.',
    scheduled_date: '2026-02-25',
    scheduled_time: '08:00',
    status: 'booked',
    assigned_engineer: 'Shane',
    created_at: '2026-02-12T09:00:00Z',
  },
  {
    id: 'j5',
    customer_id: 'c5',
    title: 'Power Flush — Completed',
    description: '8-rad system. MagnaCleanse filter fitted. Customer happy with result.',
    scheduled_date: '2026-02-14',
    scheduled_time: '08:00',
    status: 'invoiced',
    assigned_engineer: 'Shaz',
    created_at: '2026-02-05T11:00:00Z',
  },
  {
    id: 'j6',
    customer_id: 'c1',
    title: 'Boiler Service — Annual',
    description: 'Previous repair customer booking for annual service.',
    scheduled_date: '2026-02-19',
    scheduled_time: '14:00',
    status: 'enquiry',
    assigned_engineer: 'Unassigned',
    created_at: '2026-02-18T09:00:00Z',
  },
]

// ─── NOTES ────────────────────────────────────────────────────────────────────

export const notes: Note[] = [
  {
    id: 'n1',
    entity_type: 'job',
    entity_id: 'j1',
    body: 'Arrived on site. Pressure was at 0 bar. Topped up and reset — error cleared temporarily. Suspect diverter valve. Will confirm after test.',
    created_by: 'Shane',
    created_at: '2026-02-19T09:45:00Z',
  },
  {
    id: 'n2',
    entity_type: 'job',
    entity_id: 'j1',
    body: 'Diverter valve confirmed faulty. Part ordered — arrives tomorrow. Customer aware, boiler running on heating only for now.',
    created_by: 'Shane',
    created_at: '2026-02-19T11:30:00Z',
  },
  {
    id: 'n3',
    entity_type: 'customer',
    entity_id: 'c2',
    body: 'Called landlord to confirm access. Tenant Marcos will be in. Key under mat if needed.',
    created_by: 'Shaz',
    created_at: '2026-02-16T14:00:00Z',
  },
  {
    id: 'n4',
    entity_type: 'job',
    entity_id: 'j3',
    body: 'Power flush complete. All 10 rads heating evenly. MagnaCleanse filter fitted. Inhibitor dosed. Customer very happy.',
    created_by: 'Shane',
    created_at: '2026-02-18T16:30:00Z',
  },
]

// ─── QUOTES ───────────────────────────────────────────────────────────────────

export const quotes: Quote[] = [
  {
    id: 'q1',
    job_id: 'j4',
    customer_id: 'c4',
    quote_number: 'Q-2026-0012',
    document_type: 'quote',
    current_version_number: 1,
    line_items: [
      { description: 'Worcester Bosch 4000 30kW Combi Boiler (supply)', qty: 1, unit_price: 1050 },
      { description: 'Boiler installation — labour (full day)', qty: 1, unit_price: 600 },
      { description: 'Old back boiler removal & disposal', qty: 1, unit_price: 150 },
      { description: 'Flue kit and fittings', qty: 1, unit_price: 120 },
      { description: 'MagnaClean filter', qty: 1, unit_price: 95 },
    ],
    subtotal: 2015,
    vat_rate: 0,
    vat_category: 'vat_exempt',
    total: 2015,
    status: 'accepted',
    valid_until: '2026-03-01',
    created_at: '2026-02-13T10:00:00Z',
  },
  {
    id: 'q2',
    job_id: 'j2',
    customer_id: 'c2',
    quote_number: 'Q-2026-0013',
    document_type: 'estimate',
    current_version_number: 1,
    line_items: [
      { description: 'Annual boiler service — Vaillant EcoTec', qty: 1, unit_price: 85 },
      { description: 'Landlord gas safety certificate (CP12)', qty: 1, unit_price: 35 },
    ],
    subtotal: 120,
    vat_rate: 0,
    vat_category: 'vat_exempt',
    total: 120,
    status: 'sent',
    valid_until: '2026-03-05',
    created_at: '2026-02-15T11:00:00Z',
  },
]

// ─── INVOICES ─────────────────────────────────────────────────────────────────

export const invoices: Invoice[] = [
  {
    id: 'inv1',
    quote_id: null,
    job_id: 'j5',
    customer_id: 'c5',
    invoice_number: 'INV-2026-0008',
    line_items: [
      { description: 'Power flush — 8-rad system', qty: 1, unit_price: 480 },
      { description: 'MagnaCleanse filter supply & fit', qty: 1, unit_price: 95 },
      { description: 'Systemcare inhibitor (1L)', qty: 1, unit_price: 25 },
    ],
    subtotal: 600,
    vat_rate: 0,
    vat_category: 'vat_exempt',
    total: 600,
    status: 'paid',
    due_date: '2026-02-21',
    paid_at: '2026-02-18T10:00:00Z',
    created_at: '2026-02-14T17:00:00Z',
  },
  {
    id: 'inv2',
    quote_id: null,
    job_id: 'j3',
    customer_id: 'c3',
    invoice_number: 'INV-2026-0009',
    line_items: [
      { description: 'Power flush — 10-rad system', qty: 1, unit_price: 550 },
      { description: 'MagnaCleanse Pro filter supply & fit', qty: 1, unit_price: 120 },
      { description: 'Inhibitor dose', qty: 1, unit_price: 30 },
    ],
    subtotal: 700,
    vat_rate: 0,
    vat_category: 'vat_exempt',
    total: 700,
    status: 'unpaid',
    due_date: '2026-02-25',
    paid_at: null,
    created_at: '2026-02-18T17:00:00Z',
  },
]

// ─── EXPENSES ─────────────────────────────────────────────────────────────────

export const expenses: Expense[] = [
  {
    id: 'exp1',
    job_id: 'j1',
    description: 'Diverter valve — Ideal Logic compatible',
    amount: 42.5,
    category: 'materials',
    created_by: 'Shane',
    created_at: '2026-02-19T12:00:00Z',
  },
  {
    id: 'exp2',
    job_id: 'j3',
    description: 'Fernox DS40 flush chemical',
    amount: 38.0,
    category: 'materials',
    created_by: 'Shane',
    created_at: '2026-02-18T08:30:00Z',
  },
  {
    id: 'exp3',
    job_id: 'j5',
    description: 'Fuel — Hayes to Ruislip return',
    amount: 12.0,
    category: 'travel',
    created_by: 'Shaz',
    created_at: '2026-02-14T08:00:00Z',
  },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function getCustomer(id: string) {
  return customers.find((c) => c.id === id) ?? null
}

export function getJob(id: string) {
  return jobs.find((j) => j.id === id) ?? null
}

export function getJobsForCustomer(customerId: string) {
  return jobs.filter((j) => j.customer_id === customerId)
}

export function getNotesForEntity(entityType: 'customer' | 'job', entityId: string) {
  return notes.filter((n) => n.entity_type === entityType && n.entity_id === entityId)
}

export function getExpensesForJob(jobId: string) {
  return expenses.filter((e) => e.job_id === jobId)
}

export function getQuoteForJob(jobId: string) {
  return quotes.find((q) => q.job_id === jobId) ?? null
}

export function getInvoiceForJob(jobId: string) {
  return invoices.find((i) => i.job_id === jobId) ?? null
}

export function getTodaysJobs() {
  const today = new Date().toISOString().slice(0, 10)
  return jobs.filter((j) => j.scheduled_date === today)
}

export function getOpenJobsCount() {
  return jobs.filter((j) => ['enquiry', 'booked', 'in_progress'].includes(j.status)).length
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const statusConfig: Record<JobStatus, { label: string; color: string }> = {
  enquiry:     { label: 'Enquiry',     color: 'bg-yellow-100 text-yellow-800' },
  booked:      { label: 'Booked',      color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-800' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-800' },
  invoiced:    { label: 'Invoiced',    color: 'bg-purple-100 text-purple-800' },
}

export const invoiceStatusConfig: Record<InvoiceStatus, { label: string; color: string }> = {
  unpaid:  { label: 'Unpaid',  color: 'bg-yellow-100 text-yellow-800' },
  paid:    { label: 'Paid',    color: 'bg-green-100 text-green-800' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
  void:    { label: 'Void',    color: 'bg-gray-100 text-gray-500' },
}

export const quoteStatusConfig: Record<QuoteStatus, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'Sent',     color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-800' },
}
