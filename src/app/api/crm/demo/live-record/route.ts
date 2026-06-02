import { NextResponse } from "next/server";
import { z } from "zod";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";
import { IS_TEST_BEARING_TABLES } from "@/modules/crm/demo-console/server/cleanup-tables";

const recordTypes = [
  "customer",
  "lead",
  "job",
  "appointment",
  "survey_assessment",
  "quote",
  "quote_acceptance",
  "invoice_schedule",
  "invoice",
  "payment",
] as const;

const typeToTable: Record<(typeof recordTypes)[number], string> = {
  customer: "customers",
  lead: "leads",
  job: "jobs",
  appointment: "appointments",
  survey_assessment: "job_survey_assessments",
  quote: "quotes",
  quote_acceptance: "quote_acceptances",
  invoice_schedule: "invoice_schedules",
  invoice: "invoices",
  payment: "payments",
};

const querySchema = z.object({
  type: z.enum(recordTypes),
  id: z.string().uuid(),
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickId(row: Record<string, unknown>, key: string) {
  return typeof row[key] === "string" ? String(row[key]) : null;
}

function compactRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    id: pickId(row, "id"),
    label:
      pickId(row, "full_name") ??
      pickId(row, "title") ??
      pickId(row, "quote_number") ??
      pickId(row, "invoice_number") ??
      pickId(row, "label") ??
      pickId(row, "status") ??
      "Record",
    status: pickId(row, "status"),
    created_at: pickId(row, "created_at"),
    raw: safeRecord(row),
  }));
}

const unsafeRawKeys = [
  "provider_payload",
  "provider_",
  "raw_payload",
  "webhook_payload",
  "stripe",
  "payment_intent",
  "checkout_session",
  "secret",
  "token",
  "signature",
  "authorization",
  "headers",
  "bank",
  "card",
];

function safeRecord(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => {
      const lower = key.toLowerCase();
      return !unsafeRawKeys.some((unsafe) => lower.includes(unsafe));
    }),
  );
}

function uniqueRows(...groups: Record<string, unknown>[][]) {
  const rows = new Map<string, Record<string, unknown>>();
  for (const row of groups.flat()) {
    const id = pickId(row, "id");
    if (id) rows.set(id, row);
  }
  return Array.from(rows.values());
}

function uniqueIds(...groups: Array<Array<Record<string, unknown>> | Array<string | null>>) {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      if (typeof item === "string") {
        ids.add(item);
      } else if (item && typeof item === "object") {
        const id = pickId(item, "id");
        if (id) ids.add(id);
      }
    }
  }
  return Array.from(ids);
}

export async function GET(request: Request) {
  const guard = await guardDemoApi({ requireActiveSession: true });
  if (!guard.ok) return guard.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid live record query." }, { status: 400 });
  }

  const { admin, tenantId, activeSession } = guard;
  const table = typeToTable[parsed.data.type];
  let rootQuery = admin
    .schema("crm")
    .from(table)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.id);
  if (activeSession?.started_at) {
    rootQuery = rootQuery.gte("created_at", activeSession.started_at);
  }
  if (IS_TEST_BEARING_TABLES.has(table)) {
    rootQuery = rootQuery.eq("is_test", true);
  }
  const { data: root, error } = await rootQuery.maybeSingle<Record<string, unknown>>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!root) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  const rootRow = asRecord(root);
  const customerId = pickId(rootRow, "customer_id") ?? (parsed.data.type === "customer" ? parsed.data.id : null);
  const leadId = pickId(rootRow, "lead_id") ?? (parsed.data.type === "lead" ? parsed.data.id : null);
  const jobId = pickId(rootRow, "job_id") ?? (parsed.data.type === "job" ? parsed.data.id : null);
  const quoteId = pickId(rootRow, "quote_id") ?? (parsed.data.type === "quote" ? parsed.data.id : null);
  const invoiceId = pickId(rootRow, "invoice_id") ?? (parsed.data.type === "invoice" ? parsed.data.id : null);

  const since = activeSession?.started_at;
  async function list(tableName: string, key: string, value: string | null) {
    if (!value) return [] as Record<string, unknown>[];
    let query = admin.schema("crm").from(tableName).select("*").eq("tenant_id", tenantId).eq(key, value);
    if (since) {
      query = query.gte("created_at", since);
    }
    if (IS_TEST_BEARING_TABLES.has(tableName)) {
      query = query.eq("is_test", true);
    }
    const { data, error: listError } = await query.order("created_at", { ascending: false });
    if (listError) {
      throw new Error(`${tableName}: ${listError.message}`);
    }
    return (data ?? []) as Record<string, unknown>[];
  }

  async function listMany(tableName: string, key: string, values: string[]) {
    if (values.length === 0) return [] as Record<string, unknown>[];
    let query = admin.schema("crm").from(tableName).select("*").eq("tenant_id", tenantId).in(key, values);
    if (since) {
      query = query.gte("created_at", since);
    }
    if (IS_TEST_BEARING_TABLES.has(tableName)) {
      query = query.eq("is_test", true);
    }
    const { data, error: listError } = await query.order("created_at", { ascending: false });
    if (listError) {
      throw new Error(`${tableName}: ${listError.message}`);
    }
    return (data ?? []) as Record<string, unknown>[];
  }

  try {
    const [
      customers,
      leadsByCustomer,
      leadsById,
      jobsByCustomer,
      jobsByLead,
      jobsById,
      appointmentsByCustomer,
      appointmentsByLead,
      quotesById,
      invoicesById,
      paymentsByCustomer,
    ] = await Promise.all([
      list("customers", "id", customerId),
      list("leads", "customer_id", customerId),
      list("leads", "id", leadId),
      list("jobs", "customer_id", customerId),
      list("jobs", "lead_id", leadId),
      list("jobs", "id", jobId),
      list("appointments", "customer_id", customerId),
      list("appointments", "lead_id", leadId),
      list("quotes", "id", quoteId),
      list("invoices", "id", invoiceId),
      list("payments", "customer_id", customerId),
    ]);

    const linkedJobs = uniqueRows(jobsByCustomer, jobsByLead, jobsById);
    const jobIds = uniqueIds(linkedJobs, [jobId]);
    const [appointmentsByJob, surveysByJob, quotesByJob, invoicesByJob] = await Promise.all([
      listMany("appointments", "job_id", jobIds),
      listMany("job_survey_assessments", "job_id", jobIds),
      listMany("quotes", "job_id", jobIds),
      listMany("invoices", "job_id", jobIds),
    ]);
    const linkedQuotes = uniqueRows(quotesByJob, quotesById);
    const quoteIds = uniqueIds(linkedQuotes, [quoteId]);
    const [acceptancesByQuote, schedulesByQuote, invoicesByQuote, paymentsByQuote] = await Promise.all([
      listMany("quote_acceptances", "quote_id", quoteIds),
      listMany("invoice_schedules", "quote_id", quoteIds),
      listMany("invoices", "quote_id", quoteIds),
      listMany("payments", "quote_id", quoteIds),
    ]);
    const linkedInvoices = uniqueRows(invoicesByJob, invoicesByQuote, invoicesById);
    const invoiceIds = uniqueIds(linkedInvoices, [invoiceId]);
    const paymentsByInvoice = await listMany("payments", "invoice_id", invoiceIds);

    const byId = new Map<string, Record<string, unknown>>();
    for (const row of [
      ...customers,
      ...leadsByCustomer,
      ...leadsById,
      ...linkedJobs,
      ...appointmentsByCustomer,
      ...appointmentsByLead,
      ...appointmentsByJob,
      ...surveysByJob,
      ...linkedQuotes,
      ...acceptancesByQuote,
      ...schedulesByQuote,
      ...linkedInvoices,
      ...paymentsByCustomer,
      ...paymentsByQuote,
      ...paymentsByInvoice,
    ]) {
      const id = pickId(row, "id");
      if (id) byId.set(`${pickId(row, "tenant_id")}:${id}`, row);
    }
    const linked = Array.from(byId.values());

    return NextResponse.json({
      ok: true,
      type: parsed.data.type,
      record: safeRecord(rootRow),
      linked: compactRows(linked),
      commercial: {
        quotes: compactRows(linkedQuotes),
        quote_acceptances: compactRows(acceptancesByQuote),
        invoice_schedules: compactRows(schedulesByQuote),
        invoices: compactRows(linkedInvoices),
        payments: compactRows([...paymentsByCustomer, ...paymentsByQuote, ...paymentsByInvoice]),
        survey_assessments: compactRows(surveysByJob),
      },
    });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Failed to load linked CRM detail." },
      { status: 500 },
    );
  }
}
