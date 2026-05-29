import { createHmac, timingSafeEqual } from "node:crypto";
import { getCrmEnv } from "@/modules/crm/lib/env";
import type { TenantSettings } from "@/modules/crm/types";

export type PaymentLinkProvider = "stripe" | "gocardless";

export type InvoicePaymentLinkInput = {
  provider: PaymentLinkProvider;
  invoice: {
    id: string;
    tenant_id: string;
    invoice_number: string;
    total: number;
    customer_id: string;
    due_date?: string | null;
  };
  customer?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  settings: Pick<TenantSettings, "stripe_account_id" | "gocardless_merchant_id">;
  baseUrl: string;
};

export type InvoicePaymentLinkResult = {
  provider: PaymentLinkProvider;
  providerPaymentId: string;
  checkoutUrl: string;
  providerStatus: string;
  metadata: Record<string, unknown>;
};

function amountInPence(total: number) {
  return Math.max(0, Math.round(Number(total) * 100));
}

function appendFormValue(params: URLSearchParams, key: string, value: string | number | null | undefined) {
  if (value !== null && value !== undefined && String(value).length > 0) {
    params.append(key, String(value));
  }
}

function baseUrl(input: string) {
  return input.replace(/\/$/, "");
}

async function createStripeCheckoutLink(input: InvoicePaymentLinkInput): Promise<InvoicePaymentLinkResult> {
  const env = getCrmEnv();
  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const params = new URLSearchParams();
  appendFormValue(params, "mode", "payment");
  appendFormValue(params, "success_url", `${baseUrl(input.baseUrl)}/invoices/${input.invoice.id}?payment=success`);
  appendFormValue(params, "cancel_url", `${baseUrl(input.baseUrl)}/invoices/${input.invoice.id}?payment=cancelled`);
  appendFormValue(params, "client_reference_id", input.invoice.id);
  appendFormValue(params, "customer_email", input.customer?.email ?? null);
  appendFormValue(params, "line_items[0][quantity]", 1);
  appendFormValue(params, "line_items[0][price_data][currency]", "gbp");
  appendFormValue(params, "line_items[0][price_data][unit_amount]", amountInPence(input.invoice.total));
  appendFormValue(params, "line_items[0][price_data][product_data][name]", `Invoice ${input.invoice.invoice_number}`);
  appendFormValue(params, "metadata[invoice_id]", input.invoice.id);
  appendFormValue(params, "metadata[tenant_id]", input.invoice.tenant_id);
  appendFormValue(params, "metadata[customer_id]", input.invoice.customer_id);

  const headers: Record<string, string> = {
    authorization: `Bearer ${env.stripeSecretKey}`,
    "content-type": "application/x-www-form-urlencoded",
  };
  if (input.settings.stripe_account_id) {
    headers["stripe-account"] = input.settings.stripe_account_id;
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers,
    body: params.toString(),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof body.error === "object" && body.error && "message" in body.error
        ? String((body.error as Record<string, unknown>).message)
        : `Stripe returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  const id = typeof body.id === "string" ? body.id : null;
  const url = typeof body.url === "string" ? body.url : null;
  if (!id || !url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return {
    provider: "stripe",
    providerPaymentId: id,
    checkoutUrl: url,
    providerStatus: typeof body.payment_status === "string" ? body.payment_status : "requested",
    metadata: { stripeAccountId: input.settings.stripe_account_id ?? null },
  };
}

function goCardlessApiBase(environment: string) {
  return environment === "live" ? "https://api.gocardless.com" : "https://api-sandbox.gocardless.com";
}

async function createGoCardlessBillingRequestLink(input: InvoicePaymentLinkInput): Promise<InvoicePaymentLinkResult> {
  const env = getCrmEnv();
  if (!env.gocardlessAccessToken) {
    throw new Error("GOCARDLESS_ACCESS_TOKEN is not configured.");
  }

  const apiBase = goCardlessApiBase(env.gocardlessEnvironment);
  const commonHeaders = {
    authorization: `Bearer ${env.gocardlessAccessToken}`,
    "content-type": "application/json",
    "gocardless-version": "2015-07-06",
  };
  const billingRequestResponse = await fetch(`${apiBase}/billing_requests`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      billing_requests: {
        payment_request: {
          amount: amountInPence(input.invoice.total),
          currency: "GBP",
          description: `Invoice ${input.invoice.invoice_number}`,
          metadata: {
            invoice_id: input.invoice.id,
            tenant_id: input.invoice.tenant_id,
            customer_id: input.invoice.customer_id,
          },
        },
        metadata: {
          invoice_id: input.invoice.id,
          tenant_id: input.invoice.tenant_id,
        },
      },
    }),
  });
  const billingBody = (await billingRequestResponse.json().catch(() => ({}))) as Record<string, unknown>;
  if (!billingRequestResponse.ok) {
    throw new Error(`GoCardless billing request failed with HTTP ${billingRequestResponse.status}.`);
  }
  const billingRequest = billingBody.billing_requests as Record<string, unknown> | undefined;
  const billingRequestId = typeof billingRequest?.id === "string" ? billingRequest.id : null;
  if (!billingRequestId) {
    throw new Error("GoCardless did not return a billing request id.");
  }

  const flowResponse = await fetch(`${apiBase}/billing_request_flows`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      billing_request_flows: {
        redirect_uri: `${baseUrl(input.baseUrl)}/invoices/${input.invoice.id}?payment=success`,
        exit_uri: `${baseUrl(input.baseUrl)}/invoices/${input.invoice.id}?payment=cancelled`,
        links: { billing_request: billingRequestId },
      },
    }),
  });
  const flowBody = (await flowResponse.json().catch(() => ({}))) as Record<string, unknown>;
  if (!flowResponse.ok) {
    throw new Error(`GoCardless billing request flow failed with HTTP ${flowResponse.status}.`);
  }
  const flow = flowBody.billing_request_flows as Record<string, unknown> | undefined;
  const url = typeof flow?.authorisation_url === "string" ? flow.authorisation_url : null;
  if (!url) {
    throw new Error("GoCardless did not return an authorisation URL.");
  }

  return {
    provider: "gocardless",
    providerPaymentId: billingRequestId,
    checkoutUrl: url,
    providerStatus: typeof billingRequest?.status === "string" ? billingRequest.status : "requested",
    metadata: {
      billingRequestFlowId: typeof flow?.id === "string" ? flow.id : null,
      gocardlessMerchantId: input.settings.gocardless_merchant_id ?? null,
      environment: env.gocardlessEnvironment,
    },
  };
}

export async function createInvoicePaymentLink(input: InvoicePaymentLinkInput) {
  return input.provider === "stripe" ? createStripeCheckoutLink(input) : createGoCardlessBillingRequestLink(input);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  try {
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  const parts = new Map(
    (signatureHeader ?? "")
      .split(",")
      .map((part) => part.split("="))
      .filter((part): part is [string, string] => part.length === 2),
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return safeEqual(expected, signature);
}

export function verifyGoCardlessWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  const signature = signatureHeader?.trim();
  if (!signature) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}
