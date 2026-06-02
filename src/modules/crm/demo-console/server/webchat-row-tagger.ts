import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoSessionRow } from "@/modules/crm/demo-console/server/session-guard";
import { normaliseUkMobileToE164 } from "@/modules/crm/demo-console/normalise-uk-mobile";

type Row = Record<string, unknown>;

type TaggableTable =
  | "customers"
  | "leads"
  | "jobs"
  | "appointments"
  | "quotes"
  | "invoices"
  | "payments";

type TestOnlyTable =
  | "quote_versions"
  | "quote_acceptances"
  | "invoice_schedules"
  | "job_survey_assessments";

type ConversationLinkRow = {
  customer_id?: string | null;
  lead_id?: string | null;
  job_id?: string | null;
  callback_appointment_id?: string | null;
  booking_appointment_id?: string | null;
  identity_phone?: string | null;
};

export type DemoWebchatTaggingResult = {
  counts: Partial<Record<TaggableTable | TestOnlyTable, number>>;
  matchedCustomerIds: string[];
  matchedLeadIds: string[];
  matchedJobIds: string[];
  matchedQuoteIds: string[];
  matchedInvoiceIds: string[];
};

function pickString(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizePhone(value: string | null) {
  if (!value) return null;
  const normalized = normaliseUkMobileToE164(value).replace(/[^\d+]/g, "");
  return normalized.length > 0 ? normalized : null;
}

function normalizeName(value: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || null;
}

async function getConversationLink(
  supabase: SupabaseClient,
  tenantId: string,
  conversationId?: string | null,
): Promise<ConversationLinkRow | null> {
  if (!conversationId) return null;
  const { data, error } = await supabase
    .schema("crm")
    .from("platform_conversation_links")
    .select("customer_id,lead_id,job_id,callback_appointment_id,booking_appointment_id,identity_phone")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ConversationLinkRow | null;
}

async function listRecent(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  sessionStartedAt: string,
): Promise<Row[]> {
  const { data, error } = await supabase
    .schema("crm")
    .from(table)
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("created_at", sessionStartedAt)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Row[];
}

async function listRecentByColumn(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  sessionStartedAt: string,
  column: string,
  ids: string[],
): Promise<Row[]> {
  const safeIds = unique(ids);
  if (safeIds.length === 0) return [];
  const { data, error } = await supabase
    .schema("crm")
    .from(table)
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("created_at", sessionStartedAt)
    .in(column, safeIds)
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Row[];
}

async function listRecentByAnyColumn(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  sessionStartedAt: string,
  columns: Array<{ column: string; ids: string[] }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const { column, ids } of columns) {
    for (const row of await listRecentByColumn(supabase, table, tenantId, sessionStartedAt, column, ids)) {
      const id = pickString(row, "id");
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      rows.push(row);
    }
  }
  return rows;
}

async function tagRows(
  supabase: SupabaseClient,
  table: TaggableTable,
  tenantId: string,
  ids: string[],
  patch: Row,
) {
  if (ids.length === 0) return 0;
  const { error } = await supabase
    .schema("crm")
    .from(table)
    .update(patch)
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (error) throw error;
  return ids.length;
}

async function markTestRows(
  supabase: SupabaseClient,
  table: TestOnlyTable,
  tenantId: string,
  ids: string[],
) {
  if (ids.length === 0) return 0;
  const { error } = await supabase
    .schema("crm")
    .from(table)
    .update({ is_test: true })
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (error) throw error;
  return ids.length;
}

export async function tagDemoWebchatRows(input: {
  supabase: SupabaseClient;
  tenantId: string;
  session: DemoSessionRow;
  scenarioKey: string;
  conversationId?: string | null;
}): Promise<DemoWebchatTaggingResult> {
  const conversationLink = await getConversationLink(input.supabase, input.tenantId, input.conversationId);
  const phone = normalizePhone(conversationLink?.identity_phone ?? input.session.prospect_phone);
  const name = normalizeName(input.session.prospect_name);
  const demoPatch = {
    is_test: true,
    is_demo: true,
    demo_scenario_key: input.scenarioKey,
  };

  let customerIds = unique([conversationLink?.customer_id ?? null]);
  if (customerIds.length === 0) {
    const customers = await listRecent(input.supabase, "customers", input.tenantId, input.session.started_at);
    customerIds = unique(
      customers
        .filter((row) => {
          const rowPhone = normalizePhone(pickString(row, "phone"));
          const rowName = normalizeName(pickString(row, "full_name"));
          return (phone && rowPhone === phone) || (name && rowName === name);
        })
        .map((row) => pickString(row, "id")),
    );
  }

  const leads = await listRecentByColumn(input.supabase, "leads", input.tenantId, input.session.started_at, "customer_id", customerIds);
  const leadIds = unique([conversationLink?.lead_id ?? null, ...leads.map((row) => pickString(row, "id"))]);

  const jobs = await listRecentByAnyColumn(input.supabase, "jobs", input.tenantId, input.session.started_at, [
    { column: "customer_id", ids: customerIds },
    { column: "lead_id", ids: leadIds },
  ]);
  const jobIds = unique([conversationLink?.job_id ?? null, ...jobs.map((row) => pickString(row, "id"))]);

  const appointments = await listRecentByAnyColumn(input.supabase, "appointments", input.tenantId, input.session.started_at, [
    { column: "customer_id", ids: customerIds },
    { column: "lead_id", ids: leadIds },
    { column: "job_id", ids: jobIds },
  ]);
  const appointmentIds = unique([
    conversationLink?.callback_appointment_id ?? null,
    conversationLink?.booking_appointment_id ?? null,
    ...appointments.map((row) => pickString(row, "id")),
  ]);

  const surveys = await listRecentByColumn(
    input.supabase,
    "job_survey_assessments",
    input.tenantId,
    input.session.started_at,
    "job_id",
    jobIds,
  );
  const surveyIds = unique(surveys.map((row) => pickString(row, "id")));

  const quotes = await listRecentByAnyColumn(input.supabase, "quotes", input.tenantId, input.session.started_at, [
    { column: "customer_id", ids: customerIds },
    { column: "job_id", ids: jobIds },
  ]);
  const quoteIds = unique(quotes.map((row) => pickString(row, "id")));

  const quoteVersions = await listRecentByColumn(
    input.supabase,
    "quote_versions",
    input.tenantId,
    input.session.started_at,
    "quote_id",
    quoteIds,
  );
  const quoteVersionIds = unique(quoteVersions.map((row) => pickString(row, "id")));

  const quoteAcceptances = await listRecentByColumn(
    input.supabase,
    "quote_acceptances",
    input.tenantId,
    input.session.started_at,
    "quote_id",
    quoteIds,
  );
  const quoteAcceptanceIds = unique(quoteAcceptances.map((row) => pickString(row, "id")));

  const invoiceSchedules = await listRecentByColumn(
    input.supabase,
    "invoice_schedules",
    input.tenantId,
    input.session.started_at,
    "quote_id",
    quoteIds,
  );
  const invoiceScheduleIds = unique(invoiceSchedules.map((row) => pickString(row, "id")));

  const invoices = await listRecentByAnyColumn(input.supabase, "invoices", input.tenantId, input.session.started_at, [
    { column: "customer_id", ids: customerIds },
    { column: "job_id", ids: jobIds },
    { column: "quote_id", ids: quoteIds },
  ]);
  const invoiceIds = unique(invoices.map((row) => pickString(row, "id")));

  const payments = await listRecentByAnyColumn(input.supabase, "payments", input.tenantId, input.session.started_at, [
    { column: "customer_id", ids: customerIds },
    { column: "quote_id", ids: quoteIds },
    { column: "invoice_id", ids: invoiceIds },
  ]);
  const paymentIds = unique(payments.map((row) => pickString(row, "id")));

  const counts: DemoWebchatTaggingResult["counts"] = {};
  counts.customers = await tagRows(input.supabase, "customers", input.tenantId, customerIds, demoPatch);
  counts.leads = await tagRows(input.supabase, "leads", input.tenantId, leadIds, demoPatch);
  counts.jobs = await tagRows(input.supabase, "jobs", input.tenantId, jobIds, demoPatch);
  counts.appointments = await tagRows(input.supabase, "appointments", input.tenantId, appointmentIds, demoPatch);
  counts.job_survey_assessments = await markTestRows(input.supabase, "job_survey_assessments", input.tenantId, surveyIds);
  counts.quotes = await tagRows(input.supabase, "quotes", input.tenantId, quoteIds, demoPatch);
  counts.quote_versions = await markTestRows(input.supabase, "quote_versions", input.tenantId, quoteVersionIds);
  counts.quote_acceptances = await markTestRows(input.supabase, "quote_acceptances", input.tenantId, quoteAcceptanceIds);
  counts.invoice_schedules = await markTestRows(input.supabase, "invoice_schedules", input.tenantId, invoiceScheduleIds);
  counts.invoices = await tagRows(input.supabase, "invoices", input.tenantId, invoiceIds, demoPatch);
  counts.payments = await tagRows(input.supabase, "payments", input.tenantId, paymentIds, demoPatch);

  return {
    counts,
    matchedCustomerIds: customerIds,
    matchedLeadIds: leadIds,
    matchedJobIds: jobIds,
    matchedQuoteIds: quoteIds,
    matchedInvoiceIds: invoiceIds,
  };
}
