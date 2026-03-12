import { startOfDay, endOfDay } from "date-fns";
import type { DashboardData, JobType, JobWithRelations, Quote, Service, UserProfile, Customer, CustomerAsset, Note, Expense, Payment, Attachment, Appointment, Invoice, CustomerWithCounts, LeadWithRelations, QuoteWithRelations, InvoiceWithRelations, CustomFieldDefinition, RequiredDocumentRule } from "@/modules/crm/types";
import { createCrmServerClient, createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { getCrmEnv } from "@/modules/crm/lib/env";

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

export async function listUserProfiles() {
  if (!getCrmEnv().enabled) {
    return [] as UserProfile[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase.schema("crm").from("user_profiles").select("*").order("full_name");
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

export async function getDashboardData(): Promise<DashboardData> {
  if (!getCrmEnv().enabled) {
    return emptyDashboard();
  }

  const supabase = await createCrmServerClient();
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);

  const [{ data: todaysJobs }, { data: activeJobs }, { data: invoices }, { data: recentCustomers }, { data: leads }] =
    await Promise.all([
      supabase
        .schema("crm")
        .from("jobs")
        .select("*, customer:customers(id, full_name, phone, postcode), service:services(id, name), job_type:job_types(id, name)")
        .eq("scheduled_date", todayDate)
        .order("scheduled_time"),
      supabase
        .schema("crm")
        .from("jobs")
        .select("*, customer:customers(id, full_name, phone, postcode), service:services(id, name), job_type:job_types(id, name)")
        .in("status", ["enquiry", "booked", "in_progress"])
        .order("scheduled_date"),
      supabase.schema("crm").from("invoices").select("total, status"),
      supabase.schema("crm").from("customers").select("*").eq("archived", false).order("created_at", { ascending: false }).limit(5),
      supabase.schema("crm").from("leads").select("id, status").in("status", ["new", "contacted", "follow_up"]),
    ]);

  return {
    openJobsCount: (activeJobs ?? []).length,
    todaysJobs: (todaysJobs ?? []) as JobWithRelations[],
    unpaidInvoicesTotal: (invoices ?? []).filter((invoice) => invoice.status === "unpaid").reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0),
    newLeadCount: (leads ?? []).length,
    recentCustomers: (recentCustomers ?? []) as Customer[],
    activeJobs: (activeJobs ?? []) as JobWithRelations[],
  };
}

export async function listLeads() {
  if (!getCrmEnv().enabled) {
    return [] as LeadWithRelations[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("leads")
    .select("*, customer:customers(id, full_name, phone, postcode), service:services(id, name), job_type:job_types(id, name)")
    .order("created_at", { ascending: false });
  return (data ?? []) as LeadWithRelations[];
}

export async function listCustomers() {
  if (!getCrmEnv().enabled) {
    return [] as CustomerWithCounts[];
  }

  const supabase = await createCrmServerClient();
  const { data: customers } = await supabase.schema("crm").from("customers").select("*").eq("archived", false).order("created_at", { ascending: false });
  const { data: jobs } = await supabase.schema("crm").from("jobs").select("customer_id, status");

  const counts = new Map<string, { total: number; active: number }>();
  (jobs ?? []).forEach((job) => {
    const entry = counts.get(job.customer_id) ?? { total: 0, active: 0 };
    entry.total += 1;
    if (["enquiry", "booked", "in_progress"].includes(job.status)) {
      entry.active += 1;
    }
    counts.set(job.customer_id, entry);
  });

  return ((customers ?? []) as Customer[]).map((customer) => {
    const count = counts.get(customer.id) ?? { total: 0, active: 0 };
    return {
      ...customer,
      job_count: count.total,
      active_job_count: count.active,
    };
  });
}

export async function getCustomerDetail(id: string) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const supabase = await createCrmServerClient();
  const [{ data: customer }, { data: jobs }, { data: notes }, { data: assets }, { data: attachments }, { data: customFields }] =
    await Promise.all([
      supabase.schema("crm").from("customers").select("*").eq("id", id).maybeSingle(),
      supabase
        .schema("crm")
        .from("jobs")
        .select("*, customer:customers(id, full_name, phone, postcode), service:services(id, name), job_type:job_types(id, name)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase.schema("crm").from("notes").select("*").eq("entity_type", "customer").eq("entity_id", id).order("created_at", { ascending: false }),
      supabase.schema("crm").from("customer_assets").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.schema("crm").from("attachments").select("*").eq("entity_type", "customer").eq("entity_id", id).order("created_at", { ascending: false }),
      supabase.schema("crm").from("custom_field_values").select("*, field_definition:custom_field_definitions(*)").eq("entity_type", "customer").eq("entity_id", id),
    ]);

  if (!customer) {
    return null;
  }

  return {
    customer: customer as Customer,
    jobs: (jobs ?? []) as JobWithRelations[],
    notes: (notes ?? []) as Note[],
    assets: (assets ?? []) as CustomerAsset[],
    attachments: (attachments ?? []) as Attachment[],
    customFields: customFields ?? [],
  };
}

export async function listJobs() {
  if (!getCrmEnv().enabled) {
    return [] as JobWithRelations[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("jobs")
    .select("*, customer:customers(id, full_name, phone, postcode), service:services(id, name), job_type:job_types(id, name)")
    .order("scheduled_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as JobWithRelations[];
}

export async function getJobDetail(id: string) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const supabase = await createCrmServerClient();
  const [{ data: job }, { data: notes }, { data: expenses }, { data: attachments }, { data: quote }, { data: invoice }] =
    await Promise.all([
      supabase
        .schema("crm")
        .from("jobs")
        .select("*, customer:customers(id, full_name, phone, postcode), service:services(id, name), job_type:job_types(id, name)")
        .eq("id", id)
        .maybeSingle(),
      supabase.schema("crm").from("notes").select("*").eq("entity_type", "job").eq("entity_id", id).order("created_at", { ascending: false }),
      supabase.schema("crm").from("expenses").select("*").eq("job_id", id).order("created_at", { ascending: false }),
      supabase.schema("crm").from("attachments").select("*").eq("entity_type", "job").eq("entity_id", id).order("created_at", { ascending: false }),
      supabase.schema("crm").from("quotes").select("*").eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.schema("crm").from("invoices").select("*").eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

  if (!job) {
    return null;
  }

  const { data: payments } = invoice
    ? await supabase.schema("crm").from("payments").select("*").eq("invoice_id", invoice.id).order("created_at", { ascending: false })
    : { data: [] };

  return {
    job: job as JobWithRelations,
    notes: (notes ?? []) as Note[],
    expenses: (expenses ?? []) as Expense[],
    payments: (payments ?? []) as Payment[],
    attachments: (attachments ?? []) as Attachment[],
    quote: (quote ?? null) as Quote | null,
    invoice: (invoice ?? null) as Invoice | null,
  };
}

export async function listQuotes() {
  if (!getCrmEnv().enabled) {
    return [] as QuoteWithRelations[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("quotes")
    .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)")
    .order("created_at", { ascending: false });
  return (data ?? []) as QuoteWithRelations[];
}

export async function getQuoteDetail(id: string) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("quotes")
    .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as QuoteWithRelations | null;
}

export async function listInvoices() {
  if (!getCrmEnv().enabled) {
    return [] as InvoiceWithRelations[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("invoices")
    .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)")
    .order("created_at", { ascending: false });
  return (data ?? []) as InvoiceWithRelations[];
}

export async function getInvoiceDetail(id: string) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const supabase = await createCrmServerClient();
  const [{ data: invoice }, { data: payments }] = await Promise.all([
    supabase
      .schema("crm")
      .from("invoices")
      .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)")
      .eq("id", id)
      .maybeSingle(),
    supabase.schema("crm").from("payments").select("*").eq("invoice_id", id).order("created_at", { ascending: false }),
  ]);

  if (!invoice) {
    return null;
  }

  return {
    invoice: invoice as InvoiceWithRelations,
    payments: (payments ?? []) as Payment[],
  };
}

export async function listAppointmentsForCalendar() {
  if (!getCrmEnv().enabled) {
    return [] as Appointment[];
  }

  const supabase = await createCrmServerClient();
  const start = startOfDay(new Date()).toISOString();
  const end = endOfDay(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)).toISOString();

  const { data } = await supabase
    .schema("crm")
    .from("appointments")
    .select("*")
    .gte("starts_at", start)
    .lte("starts_at", end)
    .order("starts_at");
  return (data ?? []) as Appointment[];
}

export async function listAttachmentsForEntity(entityType: string, entityId: string) {
  if (!getCrmEnv().enabled) {
    return [] as Attachment[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("attachments")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
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
