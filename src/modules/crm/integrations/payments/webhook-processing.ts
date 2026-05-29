import type { SupabaseClient } from "@supabase/supabase-js";
import { cancelInvoiceChaseSequence } from "@/modules/crm/notifications/invoice-chase";

type PaymentProvider = "stripe" | "gocardless";

async function markInvoicePaid(
  supabase: SupabaseClient,
  input: { invoiceId: string; provider: PaymentProvider; providerPaymentId?: string | null; reference?: string | null; status?: string | null },
) {
  const paidAt = new Date().toISOString();
  const { data: invoice, error } = await supabase
    .schema("crm")
    .from("invoices")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", input.invoiceId)
    .select("id, tenant_id")
    .maybeSingle<{ id: string; tenant_id: string }>();
  if (error) {
    throw error;
  }
  if (!invoice) {
    return { updated: false, reason: "invoice_not_found" };
  }

  let paymentUpdate = supabase
    .schema("crm")
    .from("payments")
    .update({
      status: "received",
      received_at: paidAt,
      provider_status: input.status ?? "paid",
      reference: input.reference ?? input.providerPaymentId ?? null,
    })
    .eq("tenant_id", invoice.tenant_id)
    .eq("provider", input.provider);

  if (input.providerPaymentId) {
    paymentUpdate = paymentUpdate.eq("provider_payment_id", input.providerPaymentId);
  } else {
    paymentUpdate = paymentUpdate.eq("invoice_id", input.invoiceId);
  }
  const { error: paymentError } = await paymentUpdate;
  if (paymentError) {
    throw paymentError;
  }

  await supabase.schema("crm").from("invoice_schedules").update({ status: "paid" }).eq("invoice_id", input.invoiceId);
  await cancelInvoiceChaseSequence(supabase, { tenantId: invoice.tenant_id, invoiceId: input.invoiceId });
  return { updated: true, tenantId: invoice.tenant_id };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function processStripeWebhookEvent(supabase: SupabaseClient, event: Record<string, unknown>) {
  const type = typeof event.type === "string" ? event.type : "";
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(type)) {
    return { processed: false, ignored: type || "unknown" };
  }
  const session = asRecord(asRecord(event.data).object);
  const metadata = asRecord(session.metadata);
  const invoiceId =
    (typeof metadata.invoice_id === "string" && metadata.invoice_id) ||
    (typeof session.client_reference_id === "string" && session.client_reference_id) ||
    null;
  if (!invoiceId) {
    return { processed: false, ignored: "missing_invoice_id" };
  }
  return markInvoicePaid(supabase, {
    invoiceId,
    provider: "stripe",
    providerPaymentId: typeof session.id === "string" ? session.id : null,
    reference: typeof session.payment_intent === "string" ? session.payment_intent : null,
    status: typeof session.payment_status === "string" ? session.payment_status : "paid",
  });
}

export async function processGoCardlessWebhookEvents(supabase: SupabaseClient, body: Record<string, unknown>) {
  const events = Array.isArray(body.events) ? body.events.map(asRecord) : [];
  let processed = 0;
  for (const event of events) {
    const action = typeof event.action === "string" ? event.action : "";
    const resourceType = typeof event.resource_type === "string" ? event.resource_type : "";
    if (!["confirmed", "paid_out", "fulfilled", "payment_confirmed", "submitted"].includes(action)) {
      continue;
    }
    if (!["payments", "billing_requests"].includes(resourceType)) {
      continue;
    }
    const links = asRecord(event.links);
    const metadata = asRecord(event.metadata);
    const invoiceId = typeof metadata.invoice_id === "string" ? metadata.invoice_id : null;
    const providerPaymentId =
      (typeof links.billing_request === "string" && links.billing_request) ||
      (typeof links.payment === "string" && links.payment) ||
      (typeof event.id === "string" && event.id) ||
      null;
    if (!invoiceId && !providerPaymentId) {
      continue;
    }

    if (invoiceId) {
      await markInvoicePaid(supabase, {
        invoiceId,
        provider: "gocardless",
        providerPaymentId,
        reference: typeof links.payment === "string" ? links.payment : providerPaymentId,
        status: action,
      });
      processed += 1;
      continue;
    }

    const { data: payment, error } = await supabase
      .schema("crm")
      .from("payments")
      .select("invoice_id")
      .eq("provider", "gocardless")
      .eq("provider_payment_id", providerPaymentId)
      .maybeSingle<{ invoice_id: string | null }>();
    if (error) {
      throw error;
    }
    if (payment?.invoice_id) {
      await markInvoicePaid(supabase, {
        invoiceId: payment.invoice_id,
        provider: "gocardless",
        providerPaymentId,
        reference: typeof links.payment === "string" ? links.payment : providerPaymentId,
        status: action,
      });
      processed += 1;
    }
  }

  return { processed };
}
