import { addDays, endOfDay, isAfter, parseISO, startOfDay } from "date-fns";
import type { Appointment, Attachment, CalendarItem, Customer, CustomerAsset, CustomerWithCounts, CustomFieldDefinition, DashboardData, EngineerDashboardData, EngineerDashboardJob, Expense, Invoice, InvoiceSchedule, InvoiceWithRelations, JobAssignee, JobCertificate, JobChecklist, JobHazard, JobPhase, JobType, JobVariation, JobWithRelations, LeadWithRelations, Note, Payment, Product, PurchaseOrder, Quote, QuoteAcceptance, QuoteTemplate, QuoteVersion, QuoteWithRelations, ReportsSummary, RequiredDocumentRule, Service, Site, SiteContact, StaffDirectoryEntry, Supplier, SupplierReconciliation, UserCertification, UserProfile } from "@/modules/crm/types";
import { createCrmServerClient, createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { applyCrmModeFilter, crmDemoScenarioKey } from "@/modules/crm/lib/demo";
import { runCrmList } from "@/modules/crm/lib/data-runner";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { buildAssetReminderItems, buildLeadFollowUpItem, expandAppointmentOccurrences } from "@/modules/crm/lib/calendar";
import { summarizeEngineerDashboardJobs } from "@/modules/crm/lib/dashboard";
import { buildReportsSummary } from "@/modules/crm/lib/reporting";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import type { CrmMode } from "@/modules/crm/lib/demo";

/**
 * Decides which CRM route the Calendar "Open" button should open for an
 * appointment row. We prefer the most specific linked entity because a job
 * detail page is more useful than a calendar re-load, and the leads inbox is
 * more useful than a dead-end.
 *
 * Exported so the ordering/fallback logic can be unit-tested without wiring a
 * Supabase fixture for listAppointmentsForCalendar.
 */
export function deriveAppointmentEntityLink(appointment: {
  job_id: string | null;
  customer_id: string | null;
  customer?: { id: string } | null;
  lead_id: string | null;
  lead?: { id: string } | null;
}): string {
  if (appointment.job_id) {
    return `/jobs/${appointment.job_id}`;
  }
  const customerId = appointment.customer?.id ?? appointment.customer_id;
  if (customerId) {
    return `/customers/${customerId}`;
  }
  if (appointment.lead?.id ?? appointment.lead_id) {
    return "/leads";
  }
  return "/calendar";
}

function emptyDashboard(): DashboardData {
  return {
    openJobsCount: 0,
    todaysJobs: [],
    unpaidInvoicesTotal: 0,
    newLeadCount: 0,
    recentCustomers: [],
    activeJobs: [],
  };
}

function emptyEngineerDashboard(): EngineerDashboardData {
  return {
    nextAssignedJob: null,
    todaysAssignedJobs: [],
    overdueAssignedJobs: [],
    readyJobs: [],
    upcomingAssignedJobs: [],
    fieldTaskCounts: {
      missingNotes: 0,
      missingPhotos: 0,
      missingRequiredDocuments: 0,
      overdueJobs: 0,
    },
  };
}

async function getCrmModeContext(mode?: CrmMode) {
  if (mode) {
    return { mode, scenarioKey: crmDemoScenarioKey };
  }

  const demoState = await getCrmDemoState();
  return {
    mode: demoState.mode,
    scenarioKey: demoState.scenarioKey ?? crmDemoScenarioKey,
  };
}

type ModeQueryable = {
  eq: (column: string, value: unknown) => unknown;
};

function filterByMode(query: ModeQueryable, mode: CrmMode, scenarioKey = crmDemoScenarioKey) {
  applyCrmModeFilter(query as ModeQueryable, mode, scenarioKey);
}

async function listJobAssigneesByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobAssignee[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const assigneesQuery = supabase
    .schema("crm")
    .from("job_assignees")
    .select("*, user_profile:user_profiles(id, user_id, full_name, role)")
    .in("job_id", jobIds)
    .order("created_at", { ascending: true });
  filterByMode(assigneesQuery, context.mode, context.scenarioKey);
  const { data } = await assigneesQuery;

  const assigneesByJobId = new Map<string, JobAssignee[]>();
  for (const assignee of (data ?? []) as JobAssignee[]) {
    const current = assigneesByJobId.get(assignee.job_id) ?? [];
    current.push(assignee);
    assigneesByJobId.set(assignee.job_id, current);
  }

  return assigneesByJobId;
}

async function listJobPhasesByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobPhase[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const phasesQuery = supabase
    .schema("crm")
    .from("job_phases")
    .select("*")
    .in("job_id", jobIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  filterByMode(phasesQuery, context.mode, context.scenarioKey);
  const { data } = await phasesQuery;

  const phasesByJobId = new Map<string, JobPhase[]>();
  for (const phase of (data ?? []) as JobPhase[]) {
    const current = phasesByJobId.get(phase.job_id) ?? [];
    current.push(phase);
    phasesByJobId.set(phase.job_id, current);
  }

  return phasesByJobId;
}

async function listJobVariationsByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobVariation[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const variationsQuery = supabase
    .schema("crm")
    .from("job_variations")
    .select("*")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  filterByMode(variationsQuery, context.mode, context.scenarioKey);
  const { data } = await variationsQuery;

  const variationsByJobId = new Map<string, JobVariation[]>();
  for (const variation of (data ?? []) as JobVariation[]) {
    const current = variationsByJobId.get(variation.job_id) ?? [];
    current.push(variation);
    variationsByJobId.set(variation.job_id, current);
  }

  return variationsByJobId;
}

async function listQuoteVersionsByQuoteIds(quoteIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || quoteIds.length === 0) {
    return new Map<string, QuoteVersion[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const versionsQuery = supabase
    .schema("crm")
    .from("quote_versions")
    .select("*")
    .in("quote_id", quoteIds)
    .order("version_number", { ascending: false });
  filterByMode(versionsQuery, context.mode, context.scenarioKey);
  const { data } = await versionsQuery;

  const versionsByQuoteId = new Map<string, QuoteVersion[]>();
  for (const version of (data ?? []) as QuoteVersion[]) {
    const current = versionsByQuoteId.get(version.quote_id) ?? [];
    current.push(version);
    versionsByQuoteId.set(version.quote_id, current);
  }

  return versionsByQuoteId;
}

async function listQuoteAcceptancesByQuoteIds(quoteIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || quoteIds.length === 0) {
    return new Map<string, QuoteAcceptance>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const acceptancesQuery = supabase.schema("crm").from("quote_acceptances").select("*").in("quote_id", quoteIds);
  filterByMode(acceptancesQuery, context.mode, context.scenarioKey);
  const { data } = await acceptancesQuery;

  return new Map(((data ?? []) as QuoteAcceptance[]).map((acceptance) => [acceptance.quote_id, acceptance]));
}

async function listInvoiceSchedulesByQuoteIds(quoteIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || quoteIds.length === 0) {
    return new Map<string, InvoiceSchedule[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const schedulesQuery = supabase
    .schema("crm")
    .from("invoice_schedules")
    .select("*")
    .in("quote_id", quoteIds)
    .order("created_at", { ascending: true });
  filterByMode(schedulesQuery, context.mode, context.scenarioKey);
  const { data } = await schedulesQuery;

  const schedulesByQuoteId = new Map<string, InvoiceSchedule[]>();
  for (const schedule of (data ?? []) as InvoiceSchedule[]) {
    const current = schedulesByQuoteId.get(schedule.quote_id) ?? [];
    current.push(schedule);
    schedulesByQuoteId.set(schedule.quote_id, current);
  }

  return schedulesByQuoteId;
}

async function listJobHazardsByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobHazard[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase.schema("crm").from("job_hazards").select("*").in("job_id", jobIds).order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, JobHazard[]>();
  for (const row of (data ?? []) as JobHazard[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

async function listJobChecklistsByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobChecklist[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase.schema("crm").from("job_checklists").select("*").in("job_id", jobIds).order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, JobChecklist[]>();
  for (const row of (data ?? []) as JobChecklist[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

async function listJobCertificatesByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobCertificate[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase.schema("crm").from("job_certificates").select("*").in("job_id", jobIds).order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, JobCertificate[]>();
  for (const row of (data ?? []) as JobCertificate[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

async function listPurchaseOrdersByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, PurchaseOrder[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase
    .schema("crm")
    .from("purchase_orders")
    .select("*, supplier:suppliers(id, name)")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, PurchaseOrder[]>();
  for (const row of (data ?? []) as PurchaseOrder[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

async function listSupplierReconciliationByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, SupplierReconciliation[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase
    .schema("crm")
    .from("supplier_reconciliation")
    .select("*, supplier:suppliers(id, name)")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, SupplierReconciliation[]>();
  for (const row of (data ?? []) as SupplierReconciliation[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

export async function listUserProfiles(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as UserProfile[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const profilesQuery = supabase.schema("crm").from("user_profiles").select("*");
  filterByMode(profilesQuery, context.mode, context.scenarioKey);
  const { data } = await profilesQuery.order("full_name");
  return (data ?? []) as UserProfile[];
}

export async function listServices() {
  if (!getCrmEnv().enabled) {
    return [] as Service[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase.schema("crm").from("services").select("*").order("name");
  return (data ?? []) as Service[];
}

export async function listJobTypes() {
  if (!getCrmEnv().enabled) {
    return [] as JobType[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase.schema("crm").from("job_types").select("*").order("name");
  return (data ?? []) as JobType[];
}

export async function listCustomFieldDefinitions() {
  if (!getCrmEnv().enabled) {
    return [] as CustomFieldDefinition[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("custom_field_definitions")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  return (data ?? []) as CustomFieldDefinition[];
}

export async function listRequiredDocumentRules() {
  if (!getCrmEnv().enabled) {
    return [] as RequiredDocumentRule[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("required_document_rules")
    .select("*")
    .eq("active", true)
    .order("entity_type")
    .order("document_type");
  return (data ?? []) as RequiredDocumentRule[];
}

export async function getDashboardData(mode?: CrmMode): Promise<DashboardData> {
  if (!getCrmEnv().enabled) {
    return emptyDashboard();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const todaysJobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select("*, customer:customers(id, full_name, phone, address_line1, postcode), service:services(id, name), job_type:job_types(id, name)");
  filterByMode(todaysJobsQuery, context.mode, context.scenarioKey);
  const activeJobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select("*, customer:customers(id, full_name, phone, address_line1, postcode), service:services(id, name), job_type:job_types(id, name)");
  filterByMode(activeJobsQuery, context.mode, context.scenarioKey);
  const invoicesQuery = supabase.schema("crm").from("invoices").select("total, status");
  filterByMode(invoicesQuery, context.mode, context.scenarioKey);
  const recentCustomersQuery = supabase.schema("crm").from("customers").select("*");
  filterByMode(recentCustomersQuery, context.mode, context.scenarioKey);
  const leadsQuery = supabase.schema("crm").from("leads").select("id, status");
  filterByMode(leadsQuery, context.mode, context.scenarioKey);

  const [todaysJobs, activeJobs, invoiceRows, recentCustomers, leads] = await Promise.all([
    runCrmList<JobWithRelations>(
      "getDashboardData.todaysJobs",
      todaysJobsQuery.eq("scheduled_date", todayDate).order("scheduled_time"),
    ),
    runCrmList<JobWithRelations>(
      "getDashboardData.activeJobs",
      activeJobsQuery.in("status", ["enquiry", "booked", "in_progress"]).order("scheduled_date"),
    ),
    runCrmList<{ total: number | string | null; status: string }>("getDashboardData.invoices", invoicesQuery),
    runCrmList<Customer>(
      "getDashboardData.recentCustomers",
      recentCustomersQuery.eq("archived", false).order("created_at", { ascending: false }).limit(5),
    ),
    runCrmList<{ id: string; status: string }>(
      "getDashboardData.leads",
      leadsQuery.in("status", ["new", "contacted", "follow_up"]),
    ),
  ]);

  return {
    openJobsCount: activeJobs.length,
    todaysJobs,
    unpaidInvoicesTotal: invoiceRows
      .filter((invoice) => invoice.status === "unpaid")
      .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0),
    newLeadCount: leads.length,
    recentCustomers,
    activeJobs,
  };
}

export async function getEngineerDashboardData(engineerName: string, mode?: CrmMode): Promise<EngineerDashboardData> {
  if (!getCrmEnv().enabled || engineerName.trim().length === 0) {
    return emptyEngineerDashboard();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const todayDate = new Date().toISOString().slice(0, 10);
  const jobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select("*, customer:customers(id, full_name, phone, address_line1, postcode), site:sites(id, label, address_line1, postcode, city, access_notes, parking_notes), site_contact:site_contacts(id, full_name, phone, email, role_label), service:services(id, name), job_type:job_types(id, name)");
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  const { data: jobs } = await jobsQuery
    .ilike("assigned_engineer", engineerName.trim())
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const assignedJobs = (jobs ?? []) as JobWithRelations[];
  if (assignedJobs.length === 0) {
    return emptyEngineerDashboard();
  }

  const jobIds = assignedJobs.map((job) => job.id);
  const notesQuery = supabase.schema("crm").from("notes").select("entity_id, body, created_at");
  filterByMode(notesQuery, context.mode, context.scenarioKey);
  const attachmentsQuery = supabase.schema("crm").from("attachments").select("entity_id, file_type");
  filterByMode(attachmentsQuery, context.mode, context.scenarioKey);
  const quotesQuery = supabase.schema("crm").from("quotes").select("job_id");
  filterByMode(quotesQuery, context.mode, context.scenarioKey);
  const invoicesQuery = supabase.schema("crm").from("invoices").select("job_id");
  filterByMode(invoicesQuery, context.mode, context.scenarioKey);
  const rulesQuery = supabase.schema("crm").from("required_document_rules").select("*").eq("entity_type", "job").eq("active", true);

  const [{ data: notes }, { data: attachments }, { data: quotes }, { data: invoices }, { data: rules }] = await Promise.all([
    notesQuery.eq("entity_type", "job").in("entity_id", jobIds).order("created_at", { ascending: false }),
    attachmentsQuery.eq("entity_type", "job").in("entity_id", jobIds),
    quotesQuery.in("job_id", jobIds),
    invoicesQuery.in("job_id", jobIds),
    rulesQuery,
  ]);

  const latestNoteByJobId = new Map<string, EngineerDashboardJob["latestNote"]>();
  for (const note of (notes ?? []) as Array<Pick<Note, "body" | "created_at"> & { entity_id: string }>) {
    if (!latestNoteByJobId.has(note.entity_id)) {
      latestNoteByJobId.set(note.entity_id, { body: note.body, created_at: note.created_at });
    }
  }

  const attachmentsByJobId = new Map<string, string[]>();
  for (const attachment of (attachments ?? []) as Array<Pick<Attachment, "file_type"> & { entity_id: string }>) {
    const current = attachmentsByJobId.get(attachment.entity_id) ?? [];
    current.push(attachment.file_type);
    attachmentsByJobId.set(attachment.entity_id, current);
  }

  const quoteJobIds = new Set((quotes ?? []).map((quote) => quote.job_id));
  const invoiceJobIds = new Set((invoices ?? []).map((invoice) => invoice.job_id));
  const activeRules = (rules ?? []) as RequiredDocumentRule[];

  const enrichedJobs: EngineerDashboardJob[] = assignedJobs.map((job) => {
    const latestNote = latestNoteByJobId.get(job.id) ?? null;
    const attachmentTypes = attachmentsByJobId.get(job.id) ?? [];
    const availableTypes = new Set(attachmentTypes);
    const matchingRules = activeRules.filter((rule) => {
      const matchesService = !rule.service_id || rule.service_id === job.service_id;
      const matchesJobType = !rule.job_type_id || rule.job_type_id === job.job_type_id;
      const matchesStage = !rule.pipeline_stage || rule.pipeline_stage === job.status;
      return matchesService && matchesJobType && matchesStage && rule.required;
    });

    return {
      ...job,
      latestNote,
      attachmentCount: attachmentTypes.length,
      hasQuote: quoteJobIds.has(job.id),
      hasInvoice: invoiceJobIds.has(job.id),
      missingNote: latestNote === null,
      missingPhoto: !availableTypes.has("photo"),
      missingRequiredDocument: matchingRules.some((rule) => !availableTypes.has(rule.document_type)),
      overdue: Boolean(job.scheduled_date && job.scheduled_date < todayDate && ["enquiry", "booked", "in_progress"].includes(job.status)),
    };
  });

  return summarizeEngineerDashboardJobs(enrichedJobs, todayDate);
}

export async function listLeads(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as LeadWithRelations[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const leadsQuery = supabase
    .schema("crm")
    .from("leads")
    .select(
      "*, customer:customers!leads_customer_id_fkey(id, full_name, phone, email, address_line1, postcode), possible_duplicate_customer:customers!leads_possible_duplicate_customer_id_fkey(id, full_name, phone, email), service:services(id, name), job_type:job_types(id, name)",
    );
  filterByMode(leadsQuery, context.mode, context.scenarioKey);
  return runCrmList<LeadWithRelations>(
    "listLeads",
    leadsQuery.order("created_at", { ascending: false }),
  );
}

export async function listCustomers(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as CustomerWithCounts[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const customersQuery = supabase.schema("crm").from("customers").select("*");
  filterByMode(customersQuery, context.mode, context.scenarioKey);
  const jobsQuery = supabase.schema("crm").from("jobs").select("customer_id, status");
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  const [customers, jobs] = await Promise.all([
    runCrmList<Customer>(
      "listCustomers.customers",
      customersQuery.eq("archived", false).order("created_at", { ascending: false }),
    ),
    runCrmList<{ customer_id: string; status: string }>("listCustomers.jobs", jobsQuery),
  ]);

  const counts = new Map<string, { total: number; active: number }>();
  jobs.forEach((job) => {
    const entry = counts.get(job.customer_id) ?? { total: 0, active: 0 };
    entry.total += 1;
    if (["enquiry", "booked", "in_progress"].includes(job.status)) {
      entry.active += 1;
    }
    counts.set(job.customer_id, entry);
  });

  return customers.map((customer) => {
    const count = counts.get(customer.id) ?? { total: 0, active: 0 };
    return {
      ...customer,
      job_count: count.total,
      active_job_count: count.active,
    };
  });
}

export async function listSites(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Array<Site & { customer?: Pick<Customer, "id" | "full_name"> | null }>;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const sitesQuery = supabase.schema("crm").from("sites").select("*, customer:customers(id, full_name)");
  filterByMode(sitesQuery, context.mode, context.scenarioKey);
  return runCrmList<Site & { customer?: Pick<Customer, "id" | "full_name"> | null }>(
    "listSites",
    sitesQuery.order("is_primary", { ascending: false }).order("label", { ascending: true }),
  );
}

export async function listSiteContacts(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Array<SiteContact & { site?: Pick<Site, "id" | "label" | "customer_id"> | null }>;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const contactsQuery = supabase.schema("crm").from("site_contacts").select("*, site:sites(id, label, customer_id)");
  filterByMode(contactsQuery, context.mode, context.scenarioKey);
  return runCrmList<SiteContact & { site?: Pick<Site, "id" | "label" | "customer_id"> | null }>(
    "listSiteContacts",
    contactsQuery.order("is_primary", { ascending: false }).order("full_name", { ascending: true }),
  );
}

export async function getCustomerDetail(id: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const customerQuery = supabase.schema("crm").from("customers").select("*");
  filterByMode(customerQuery, context.mode, context.scenarioKey);
  const jobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select("*, customer:customers(id, full_name, phone, address_line1, postcode), site:sites(id, label, address_line1, postcode, city, access_notes, parking_notes), site_contact:site_contacts(id, full_name, phone, email, role_label), service:services(id, name), job_type:job_types(id, name)");
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  const notesQuery = supabase.schema("crm").from("notes").select("*");
  filterByMode(notesQuery, context.mode, context.scenarioKey);
  const assetsQuery = supabase.schema("crm").from("customer_assets").select("*");
  filterByMode(assetsQuery, context.mode, context.scenarioKey);
  const sitesQuery = supabase.schema("crm").from("sites").select("*");
  filterByMode(sitesQuery, context.mode, context.scenarioKey);
  const attachmentsQuery = supabase.schema("crm").from("attachments").select("*");
  filterByMode(attachmentsQuery, context.mode, context.scenarioKey);
  const [{ data: customer }, { data: jobs }, { data: notes }, { data: assets }, { data: sites }, { data: attachments }, { data: customFields }] =
    await Promise.all([
      customerQuery.eq("id", id).maybeSingle(),
      jobsQuery.eq("customer_id", id).order("created_at", { ascending: false }),
      notesQuery.eq("entity_type", "customer").eq("entity_id", id).order("created_at", { ascending: false }),
      assetsQuery.eq("customer_id", id).order("created_at", { ascending: false }),
      sitesQuery.eq("customer_id", id).order("is_primary", { ascending: false }).order("created_at", { ascending: false }),
      attachmentsQuery.eq("entity_type", "customer").eq("entity_id", id).order("created_at", { ascending: false }),
      supabase.schema("crm").from("custom_field_values").select("*, field_definition:custom_field_definitions(*)").eq("entity_type", "customer").eq("entity_id", id),
    ]);

  if (!customer) {
    return null;
  }

  const customerJobs = (jobs ?? []) as JobWithRelations[];
  const assigneesByJobId = await listJobAssigneesByJobIds(
    customerJobs.map((job) => job.id),
    context.mode,
  );
  const siteIds = ((sites ?? []) as Site[]).map((site) => site.id);
  let siteContacts: Array<SiteContact & { site?: Pick<Site, "id" | "label"> | null }> = [];
  if (siteIds.length > 0) {
    const siteContactsQuery = supabase.schema("crm").from("site_contacts").select("*, site:sites(id, label)");
    filterByMode(siteContactsQuery, context.mode, context.scenarioKey);
    const { data } = await siteContactsQuery.in("site_id", siteIds).order("is_primary", { ascending: false }).order("created_at", { ascending: false });
    siteContacts = (data ?? []) as Array<SiteContact & { site?: Pick<Site, "id" | "label"> | null }>;
  }

  return {
    customer: customer as Customer,
    jobs: customerJobs.map((job) => ({ ...job, assignees: assigneesByJobId.get(job.id) ?? [] })),
    notes: (notes ?? []) as Note[],
    assets: (assets ?? []) as CustomerAsset[],
    sites: (sites ?? []) as Site[],
    siteContacts,
    attachments: (attachments ?? []) as Attachment[],
    customFields: customFields ?? [],
  };
}

export async function listJobs(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as JobWithRelations[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const jobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select("*, customer:customers(id, full_name, phone, address_line1, postcode), site:sites(id, label, address_line1, postcode, city, access_notes, parking_notes), site_contact:site_contacts(id, full_name, phone, email, role_label), service:services(id, name), job_type:job_types(id, name)");
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  // Jobs behave like an inbox: the top of the list should be the most recently
  // submitted booking, not "what's next on the diary" (that's the Calendar
  // page's job). Tie-break on scheduled_date so two jobs created in the same
  // instant still sort deterministically.
  const jobs = await runCrmList<JobWithRelations>(
    "listJobs",
    jobsQuery.order("created_at", { ascending: false }).order("scheduled_date", { ascending: false, nullsFirst: false }),
  );
  const jobIds = jobs.map((job) => job.id);
  const [assigneesByJobId, phasesByJobId, variationsByJobId] = await Promise.all([
    listJobAssigneesByJobIds(jobIds, context.mode),
    listJobPhasesByJobIds(jobIds, context.mode),
    listJobVariationsByJobIds(jobIds, context.mode),
  ]);
  return jobs.map((job) => ({
    ...job,
    assignees: assigneesByJobId.get(job.id) ?? [],
    phases: phasesByJobId.get(job.id) ?? [],
    variations: variationsByJobId.get(job.id) ?? [],
  }));
}

export async function getJobDetail(id: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const jobQuery = supabase
    .schema("crm")
    .from("jobs")
    .select("*, customer:customers(id, full_name, phone, email, address_line1, postcode), site:sites(id, label, address_line1, postcode, city, access_notes, parking_notes), site_contact:site_contacts(id, full_name, phone, email, role_label), service:services(id, name), job_type:job_types(id, name)");
  filterByMode(jobQuery, context.mode, context.scenarioKey);
  const notesQuery = supabase.schema("crm").from("notes").select("*");
  filterByMode(notesQuery, context.mode, context.scenarioKey);
  const expensesQuery = supabase.schema("crm").from("expenses").select("*");
  filterByMode(expensesQuery, context.mode, context.scenarioKey);
  const attachmentsQuery = supabase.schema("crm").from("attachments").select("*");
  filterByMode(attachmentsQuery, context.mode, context.scenarioKey);
  const quoteQuery = supabase.schema("crm").from("quotes").select("*");
  filterByMode(quoteQuery, context.mode, context.scenarioKey);
  const invoiceQuery = supabase.schema("crm").from("invoices").select("*");
  filterByMode(invoiceQuery, context.mode, context.scenarioKey);
  const [{ data: job }, { data: notes }, { data: expenses }, { data: attachments }, { data: quote }, { data: invoice }] =
    await Promise.all([
      jobQuery.eq("id", id).maybeSingle(),
      notesQuery.eq("entity_type", "job").eq("entity_id", id).order("created_at", { ascending: false }),
      expensesQuery.eq("job_id", id).order("created_at", { ascending: false }),
      attachmentsQuery.eq("entity_type", "job").eq("entity_id", id).order("created_at", { ascending: false }),
      quoteQuery.eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      invoiceQuery.eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

  if (!job) {
    return null;
  }

  const [assigneesByJobId, phasesByJobId, variationsByJobId, hazardsByJobId, checklistsByJobId, certificatesByJobId, purchaseOrdersByJobId, supplierReconciliationByJobId] = await Promise.all([
    listJobAssigneesByJobIds([id], context.mode),
    listJobPhasesByJobIds([id], context.mode),
    listJobVariationsByJobIds([id], context.mode),
    listJobHazardsByJobIds([id], context.mode),
    listJobChecklistsByJobIds([id], context.mode),
    listJobCertificatesByJobIds([id], context.mode),
    listPurchaseOrdersByJobIds([id], context.mode),
    listSupplierReconciliationByJobIds([id], context.mode),
  ]);

  const paymentsQuery = supabase.schema("crm").from("payments").select("*");
  filterByMode(paymentsQuery, context.mode, context.scenarioKey);
  const { data: payments } = invoice ? await paymentsQuery.eq("invoice_id", invoice.id).order("created_at", { ascending: false }) : { data: [] };

  return {
    job: {
      ...(job as JobWithRelations),
      assignees: assigneesByJobId.get(id) ?? [],
      phases: phasesByJobId.get(id) ?? [],
      variations: variationsByJobId.get(id) ?? [],
      hazards: hazardsByJobId.get(id) ?? [],
      checklists: checklistsByJobId.get(id) ?? [],
      certificates: certificatesByJobId.get(id) ?? [],
      purchaseOrders: purchaseOrdersByJobId.get(id) ?? [],
      supplierReconciliation: supplierReconciliationByJobId.get(id) ?? [],
    },
    notes: (notes ?? []) as Note[],
    expenses: (expenses ?? []) as Expense[],
    payments: (payments ?? []) as Payment[],
    attachments: (attachments ?? []) as Attachment[],
    quote: (quote ?? null) as Quote | null,
    invoice: (invoice ?? null) as Invoice | null,
  };
}

export async function listQuotes(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as QuoteWithRelations[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const quotesQuery = supabase
    .schema("crm")
    .from("quotes")
    .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)");
  filterByMode(quotesQuery, context.mode, context.scenarioKey);
  const quotes = await runCrmList<QuoteWithRelations>(
    "listQuotes",
    quotesQuery.order("created_at", { ascending: false }),
  );
  const quoteIds = quotes.map((quote) => quote.id);
  const [versionsByQuoteId, acceptancesByQuoteId, schedulesByQuoteId] = await Promise.all([
    listQuoteVersionsByQuoteIds(quoteIds, context.mode),
    listQuoteAcceptancesByQuoteIds(quoteIds, context.mode),
    listInvoiceSchedulesByQuoteIds(quoteIds, context.mode),
  ]);
  return quotes.map((quote) => ({
    ...quote,
    versions: versionsByQuoteId.get(quote.id) ?? [],
    acceptance: acceptancesByQuoteId.get(quote.id) ?? null,
    invoiceSchedules: schedulesByQuoteId.get(quote.id) ?? [],
  }));
}

export async function getQuoteDetail(id: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const quoteQuery = supabase
    .schema("crm")
    .from("quotes")
    .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)");
  filterByMode(quoteQuery, context.mode, context.scenarioKey);
  const { data } = await quoteQuery.eq("id", id).maybeSingle();
  if (!data) {
    return null;
  }
  const [versionsByQuoteId, acceptancesByQuoteId, schedulesByQuoteId] = await Promise.all([
    listQuoteVersionsByQuoteIds([id], context.mode),
    listQuoteAcceptancesByQuoteIds([id], context.mode),
    listInvoiceSchedulesByQuoteIds([id], context.mode),
  ]);
  return {
    ...(data as QuoteWithRelations),
    versions: versionsByQuoteId.get(id) ?? [],
    acceptance: acceptancesByQuoteId.get(id) ?? null,
    invoiceSchedules: schedulesByQuoteId.get(id) ?? [],
  } satisfies QuoteWithRelations;
}

export async function listInvoices(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as InvoiceWithRelations[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const invoicesQuery = supabase
    .schema("crm")
    .from("invoices")
    .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)");
  filterByMode(invoicesQuery, context.mode, context.scenarioKey);
  return runCrmList<InvoiceWithRelations>(
    "listInvoices",
    invoicesQuery.order("created_at", { ascending: false }),
  );
}

export async function getInvoiceDetail(id: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const invoiceQuery = supabase
    .schema("crm")
    .from("invoices")
    .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)");
  filterByMode(invoiceQuery, context.mode, context.scenarioKey);
  const paymentsQuery = supabase.schema("crm").from("payments").select("*");
  filterByMode(paymentsQuery, context.mode, context.scenarioKey);
  const [{ data: invoice }, { data: payments }] = await Promise.all([
    invoiceQuery.eq("id", id).maybeSingle(),
    paymentsQuery.eq("invoice_id", id).order("created_at", { ascending: false }),
  ]);

  if (!invoice) {
    return null;
  }

  return {
    invoice: invoice as InvoiceWithRelations,
    payments: (payments ?? []) as Payment[],
  };
}

export async function listAppointmentsForCalendar(filters?: {
  assignedTo?: string | null;
  type?: string | null;
  status?: string | null;
  days?: number;
  mode?: CrmMode;
}) {
  if (!getCrmEnv().enabled) {
    return [] as CalendarItem[];
  }

  const context = await getCrmModeContext(filters?.mode);
  const supabase = await createCrmServerClient();
  const days = filters?.days ?? 7;
  const start = startOfDay(new Date());
  const end = endOfDay(addDays(start, days));
  const appointmentsQuery = supabase
    .schema("crm")
    .from("appointments")
    .select("*, customer:customers(id, full_name, postcode), lead:leads(id, status, source)");
  filterByMode(appointmentsQuery, context.mode, context.scenarioKey);
  const leadsQuery = supabase
    .schema("crm")
    .from("leads")
    .select("id, status, source, assigned_to, next_action_at, customer:customers(id, full_name, postcode)");
  filterByMode(leadsQuery, context.mode, context.scenarioKey);
  const assetsQuery = supabase
    .schema("crm")
    .from("customer_assets")
    .select("*, customer:customers(id, full_name, postcode)");
  filterByMode(assetsQuery, context.mode, context.scenarioKey);
  const usersQuery = supabase.schema("crm").from("user_profiles").select("*");
  filterByMode(usersQuery, context.mode, context.scenarioKey);

  const [{ data: appointments }, { data: leads }, { data: assets }, { data: users }] = await Promise.all([
    appointmentsQuery.gte("starts_at", start.toISOString()).lte("starts_at", end.toISOString()).order("starts_at"),
    leadsQuery.not("next_action_at", "is", null).gte("next_action_at", start.toISOString()).lte("next_action_at", end.toISOString()),
    assetsQuery.order("service_due_date"),
    usersQuery,
  ]);

  const usersById = new Map<string, UserProfile>(((users ?? []) as UserProfile[]).map((user) => [user.user_id, user]));
  const items: CalendarItem[] = [];

  for (const appointment of (appointments ?? []) as Array<Appointment & { customer?: CalendarItem["customer"]; lead?: CalendarItem["lead"] }>) {
    const appointmentEntityLink = deriveAppointmentEntityLink({
      job_id: appointment.job_id,
      customer_id: appointment.customer_id,
      customer: appointment.customer,
      lead_id: appointment.lead_id,
      lead: appointment.lead,
    });

    for (const occurrence of expandAppointmentOccurrences(appointment, start, end)) {
      const owner = occurrence.assigned_to ? usersById.get(occurrence.assigned_to) ?? null : null;
      items.push({
        ...occurrence,
        source: "appointment",
        customer: appointment.customer ?? null,
        lead: appointment.lead ?? null,
        owner: owner ? { id: owner.id, full_name: owner.full_name, role: owner.role } : null,
        recurrence_origin_id: appointment.id,
        entity_link: appointmentEntityLink,
      });
    }
  }

  for (const lead of (leads ?? []) as unknown as Array<{
    id: string;
    status: LeadWithRelations["status"];
    source: string | null;
    assigned_to: string | null;
    next_action_at: string | null;
    customer?: Array<{ id: string; full_name: string; postcode: string | null }> | { id: string; full_name: string; postcode: string | null } | null;
  }>) {
    if (!lead.next_action_at) {
      continue;
    }
    const customer = Array.isArray(lead.customer) ? lead.customer[0] ?? null : lead.customer ?? null;
    const nextActionAt = lead.next_action_at;
    items.push(buildLeadFollowUpItem({ ...lead, customer, next_action_at: nextActionAt }, usersById));
  }

  for (const asset of assets ?? []) {
    items.push(...buildAssetReminderItems(asset as CustomerAsset & { customer?: CalendarItem["customer"] }, start, end));
  }

  return items
    .filter((item) => !isAfter(start, parseISO(item.starts_at)))
    .filter((item) => !filters?.assignedTo || item.assigned_to === filters.assignedTo)
    .filter((item) => !filters?.type || item.type === filters.type)
    .filter((item) => !filters?.status || item.status === filters.status)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function listAttachmentsForEntity(entityType: string, entityId: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Attachment[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const attachmentsQuery = supabase.schema("crm").from("attachments").select("*");
  filterByMode(attachmentsQuery, context.mode, context.scenarioKey);
  const { data } = await attachmentsQuery.eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: false });
  return (data ?? []) as Attachment[];
}

export async function createSignedAttachmentUrl(path: string) {
  const env = getCrmEnv();
  if (!env.adminEnabled) {
    return null;
  }

  const admin = createCrmServiceRoleClient();
  const { data } = await admin.storage.from("crm-uploads").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function listStaffDirectory(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as StaffDirectoryEntry[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const profilesQuery = supabase.schema("crm").from("user_profiles").select("*");
  filterByMode(profilesQuery, context.mode, context.scenarioKey);
  const certificationsQuery = supabase.schema("crm").from("user_certifications").select("*");
  filterByMode(certificationsQuery, context.mode, context.scenarioKey);
  const [{ data: profiles }, { data: certifications }] = await Promise.all([
    profilesQuery.order("full_name"),
    certificationsQuery.order("expiry_date", { ascending: true, nullsFirst: false }),
  ]);

  const certificationsByProfile = new Map<string, UserCertification[]>();
  for (const certification of (certifications ?? []) as UserCertification[]) {
    const current = certificationsByProfile.get(certification.user_profile_id) ?? [];
    current.push(certification);
    certificationsByProfile.set(certification.user_profile_id, current);
  }

  return ((profiles ?? []) as UserProfile[]).map((profile) => ({
    ...profile,
    certifications: certificationsByProfile.get(profile.id) ?? [],
  }));
}

export async function getReportsSummary(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return {
      totalRevenue: 0,
      unpaidRevenue: 0,
      invoiceCount: 0,
      paidInvoiceCount: 0,
      leadCount: 0,
      convertedLeadCount: 0,
      jobCount: 0,
      completedJobCount: 0,
      totalExpenses: 0,
      profitEstimate: 0,
      engineerWorkload: [],
    } satisfies ReportsSummary;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const invoicesQuery = supabase.schema("crm").from("invoices").select("total, status");
  filterByMode(invoicesQuery, context.mode, context.scenarioKey);
  const leadsQuery = supabase.schema("crm").from("leads").select("status");
  filterByMode(leadsQuery, context.mode, context.scenarioKey);
  const jobsQuery = supabase.schema("crm").from("jobs").select("status, assigned_engineer");
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  const expensesQuery = supabase.schema("crm").from("expenses").select("amount");
  filterByMode(expensesQuery, context.mode, context.scenarioKey);
  const [{ data: invoices }, { data: leads }, { data: jobs }, { data: expenses }] = await Promise.all([
    invoicesQuery,
    leadsQuery,
    jobsQuery,
    expensesQuery,
  ]);

  return buildReportsSummary({
    invoices: (invoices ?? []) as Array<{ total: number | string | null; status: string }>,
    leads: (leads ?? []) as Array<{ status: LeadWithRelations["status"] }>,
    jobs: (jobs ?? []) as Array<{ status: JobWithRelations["status"]; assigned_engineer: string | null }>,
    expenses: (expenses ?? []) as Array<{ amount: number | string | null }>,
  });
}

export async function listSuppliers(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Supplier[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const suppliersQuery = supabase.schema("crm").from("suppliers").select("*");
  filterByMode(suppliersQuery, context.mode, context.scenarioKey);
  const { data } = await suppliersQuery.order("name");
  return (data ?? []) as Supplier[];
}

export async function listProducts(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Product[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const productsQuery = supabase.schema("crm").from("products").select("*");
  filterByMode(productsQuery, context.mode, context.scenarioKey);
  const { data } = await productsQuery.order("name");
  return (data ?? []) as Product[];
}

export async function listQuoteTemplates(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as QuoteTemplate[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const templatesQuery = supabase.schema("crm").from("quote_templates").select("*");
  filterByMode(templatesQuery, context.mode, context.scenarioKey);
  const { data } = await templatesQuery.order("name");
  return (data ?? []) as QuoteTemplate[];
}
