import type { SupabaseClient } from "@supabase/supabase-js";
import { renderNotificationTemplate } from "@/modules/crm/notifications/render";
import { cancelScheduledNotifications, scheduleNotification } from "@/modules/crm/notifications/scheduler";

const INVOICE_CHASE_STEPS = [
  { key: "invoice_overdue_0d", delayDays: 0 },
  { key: "invoice_overdue_7d", delayDays: 7 },
  { key: "invoice_overdue_14d", delayDays: 14 },
  { key: "invoice_overdue_21d_final", delayDays: 21 },
] as const;

type InvoiceChaseInvoice = {
  id: string;
  tenant_id: string;
  customer_id: string;
  invoice_number: string;
  status: string;
  due_date: string | null;
  is_demo?: boolean | null;
  customer?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};

type FinalChaseNotification = {
  metadata: Record<string, unknown> | null;
};

type SupabaseRelation<T> = T | T[] | null | undefined;

function firstRelation<T>(value: SupabaseRelation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseDueDate(value: string) {
  return new Date(`${value}T09:00:00.000Z`);
}

export async function cancelInvoiceChaseSequence(
  supabase: SupabaseClient,
  input: { tenantId: string; invoiceId: string },
) {
  await cancelScheduledNotifications(supabase, {
    tenantId: input.tenantId,
    metadataMatch: { sequence: "invoice_chase", invoice_id: input.invoiceId },
  });
}

async function flagFinalChaseCustomers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .schema("crm")
    .from("scheduled_notifications")
    .select("metadata")
    .eq("status", "sent")
    .eq("metadata->>sequence", "invoice_chase")
    .eq("metadata->>step", "invoice_overdue_21d_final")
    .limit(100);
  if (error) {
    throw error;
  }

  const customerIds = [
    ...new Set(
      ((data ?? []) as FinalChaseNotification[])
        .map((row) => row.metadata?.customer_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ];

  if (customerIds.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .schema("crm")
    .from("customers")
    .update({ requires_call: true })
    .in("id", customerIds);
  if (updateError) {
    throw updateError;
  }

  return customerIds.length;
}

export async function scheduleInvoiceChaseSequence(
  supabase: SupabaseClient,
  input: { tenantId: string; invoiceId: string },
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("invoices")
    .select(
      "id, tenant_id, customer_id, invoice_number, status, due_date, is_demo, customer:customers(id, full_name, email)",
    )
    .eq("tenant_id", input.tenantId)
    .eq("id", input.invoiceId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return { scheduled: 0, skipped: "invoice_not_found" };
  }

  const row = data as unknown as Omit<InvoiceChaseInvoice, "customer"> & {
    customer: SupabaseRelation<NonNullable<InvoiceChaseInvoice["customer"]>>;
  };
  const invoice: InvoiceChaseInvoice = { ...row, customer: firstRelation(row.customer) };

  if (!["unpaid", "overdue"].includes(invoice.status)) {
    await cancelInvoiceChaseSequence(supabase, { tenantId: input.tenantId, invoiceId: invoice.id });
    return { scheduled: 0, skipped: "invoice_not_unpaid" };
  }
  if (!invoice.due_date) {
    return { scheduled: 0, skipped: "missing_due_date" };
  }

  const recipient = invoice.customer?.email?.trim();
  if (!recipient) {
    return { scheduled: 0, skipped: "missing_customer_email" };
  }

  const dueDate = parseDueDate(invoice.due_date);
  const paymentLink = `${getBaseUrl()}/invoices/${invoice.id}`;
  const contactRoute = process.env.CRM_BILLING_CONTACT_EMAIL ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "the office";
  const variables = {
    customer_name: invoice.customer?.full_name?.trim() || "there",
    invoice_number: invoice.invoice_number,
    payment_link: paymentLink,
    contact_route: contactRoute,
  };

  for (const step of INVOICE_CHASE_STEPS) {
    const rendered = await renderNotificationTemplate(supabase, {
      tenantId: input.tenantId,
      key: step.key,
      channel: "email",
      variables,
    });
    await scheduleNotification(supabase, {
      tenantId: input.tenantId,
      recipient,
      channel: "email",
      templateKey: rendered.template.key,
      payload: {
        subject: rendered.subject ?? `Invoice ${invoice.invoice_number}`,
        html: rendered.body,
      },
      dispatchAt: addDays(dueDate, step.delayDays),
      idempotencyKey: `invoice:${invoice.id}:chase:${step.key}`,
      isTest: invoice.is_demo === true,
      metadata: {
        sequence: "invoice_chase",
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        step: step.key,
      },
    });
  }

  return { scheduled: INVOICE_CHASE_STEPS.length, skipped: null };
}

export async function scheduleDueInvoiceChases(
  supabase: SupabaseClient,
  options: { now?: Date; limit?: number } = {},
) {
  const now = options.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .schema("crm")
    .from("invoices")
    .select("id, tenant_id")
    .in("status", ["unpaid", "overdue"])
    .not("due_date", "is", null)
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(options.limit ?? 50);
  if (error) {
    throw error;
  }

  let scheduled = 0;
  let skipped = 0;
  for (const invoice of (data ?? []) as Array<{ id: string; tenant_id: string }>) {
    const result = await scheduleInvoiceChaseSequence(supabase, {
      tenantId: invoice.tenant_id,
      invoiceId: invoice.id,
    });
    scheduled += result.scheduled;
    skipped += result.skipped ? 1 : 0;
  }

  const customersFlagged = await flagFinalChaseCustomers(supabase);
  return { invoices: data?.length ?? 0, scheduled, skipped, customersFlagged };
}
