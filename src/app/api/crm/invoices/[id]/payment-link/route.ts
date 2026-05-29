import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { createInvoicePaymentLink } from "@/modules/crm/integrations/payments/payment-links";
import type { TenantSettings } from "@/modules/crm/types";

function getBaseUrl(request: Request) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiUser(["management", "admin", "accounts"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const { supabase, tenant } = auth.session;
  const { data: invoice, error } = await supabase
    .schema("crm")
    .from("invoices")
    .select("id, tenant_id, customer_id, invoice_number, total, status, due_date, customer:customers(full_name, email)")
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return jsonError(error.message, 500);
  }
  if (!invoice) {
    return jsonError("Invoice not found.", 404);
  }
  if (invoice.status === "paid" || invoice.status === "void") {
    return jsonError("Payment links can only be created for unpaid invoices.", 409);
  }

  const { data: settings, error: settingsError } = await supabase
    .schema("crm")
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", tenant.id)
    .maybeSingle<TenantSettings>();
  if (settingsError) {
    return jsonError(settingsError.message, 500);
  }
  const provider = settings?.payment_primary_provider ?? "none";
  if (provider !== "stripe" && provider !== "gocardless") {
    return jsonError("No payment provider is configured for this tenant.", 400);
  }

  try {
    const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
    const link = await createInvoicePaymentLink({
      provider,
      invoice: {
        id: invoice.id,
        tenant_id: invoice.tenant_id,
        invoice_number: invoice.invoice_number,
        total: Number(invoice.total),
        customer_id: invoice.customer_id,
        due_date: invoice.due_date,
      },
      customer,
      settings: settings ?? ({} as TenantSettings),
      baseUrl: getBaseUrl(request),
    });

    const { data: payment, error: paymentError } = await supabase
      .schema("crm")
      .from("payments")
      .insert({
        tenant_id: tenant.id,
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        payment_type: "final",
        amount: invoice.total,
        status: "requested",
        requested_at: new Date().toISOString(),
        reference: link.providerPaymentId,
        notes: `${link.provider} payment link created.`,
        provider: link.provider,
        provider_payment_id: link.providerPaymentId,
        provider_checkout_url: link.checkoutUrl,
        provider_status: link.providerStatus,
        provider_metadata: link.metadata,
      })
      .select("*")
      .single();
    if (paymentError) {
      return jsonError(paymentError.message, 500);
    }

    return jsonSuccess({ payment, checkout_url: link.checkoutUrl, provider: link.provider });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create payment link.", 500);
  }
}
