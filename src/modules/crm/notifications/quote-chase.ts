import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCurrency } from "@/modules/crm/lib/format";
import { buildPublicLinkUrl, mintToken } from "@/modules/crm/lib/public-quote";
import { renderNotificationTemplate } from "@/modules/crm/notifications/render";
import { cancelScheduledNotifications, scheduleNotification } from "@/modules/crm/notifications/scheduler";

const QUOTE_CHASE_STEPS = [
  { key: "quote_chase_3d", delayDays: 3 },
  { key: "quote_chase_7d", delayDays: 7 },
  { key: "quote_chase_14d", delayDays: 14 },
] as const;

type QuoteChaseQuote = {
  id: string;
  tenant_id: string;
  quote_number: string;
  status: string;
  total: number | string;
  public_token?: string | null;
  public_token_expires_at?: string | null;
  is_demo?: boolean | null;
  customer?: {
    id: string;
    full_name: string | null;
    phone: string | null;
  } | null;
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

function isExpired(value: string | null | undefined) {
  return !value || new Date(value).getTime() <= Date.now();
}

async function ensureQuotePublicUrl(supabase: SupabaseClient, quote: QuoteChaseQuote) {
  if (quote.public_token && !isExpired(quote.public_token_expires_at)) {
    return buildPublicLinkUrl(getBaseUrl(), quote.public_token);
  }

  const minted = mintToken(30);
  const { error } = await supabase
    .schema("crm")
    .from("quotes")
    .update({ public_token: minted.token, public_token_expires_at: minted.expires_at })
    .eq("id", quote.id)
    .eq("tenant_id", quote.tenant_id);
  if (error) {
    throw error;
  }

  return buildPublicLinkUrl(getBaseUrl(), minted.token);
}

export async function cancelQuoteChaseSequence(
  supabase: SupabaseClient,
  input: { tenantId: string; quoteId: string },
) {
  await cancelScheduledNotifications(supabase, {
    tenantId: input.tenantId,
    metadataMatch: { sequence: "quote_chase", quote_id: input.quoteId },
  });
}

export async function scheduleQuoteChaseSequence(
  supabase: SupabaseClient,
  input: { tenantId: string; quoteId: string; sentAt?: Date },
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("quotes")
    .select(
      "id, tenant_id, quote_number, status, total, public_token, public_token_expires_at, is_demo, customer:customers(id, full_name, phone)",
    )
    .eq("id", input.quoteId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return { scheduled: 0, skipped: "quote_not_found" };
  }

  const row = data as unknown as Omit<QuoteChaseQuote, "customer"> & {
    customer: SupabaseRelation<NonNullable<QuoteChaseQuote["customer"]>>;
  };
  const quote: QuoteChaseQuote = { ...row, customer: firstRelation(row.customer) };
  if (quote.status !== "sent") {
    return { scheduled: 0, skipped: "quote_not_sent" };
  }

  const recipient = quote.customer?.phone?.trim();
  if (!recipient) {
    return { scheduled: 0, skipped: "missing_customer_phone" };
  }

  await cancelQuoteChaseSequence(supabase, { tenantId: input.tenantId, quoteId: input.quoteId });

  const sentAt = input.sentAt ?? new Date();
  const quoteUrl = await ensureQuotePublicUrl(supabase, quote);
  const variables = {
    customer_name: quote.customer?.full_name?.trim() || "there",
    quote_number: quote.quote_number,
    quote_total: formatCurrency(Number(quote.total)),
    quote_url: quoteUrl,
  };

  for (const step of QUOTE_CHASE_STEPS) {
    const rendered = await renderNotificationTemplate(supabase, {
      tenantId: input.tenantId,
      key: step.key,
      channel: "sms",
      variables,
    });
    await scheduleNotification(supabase, {
      tenantId: input.tenantId,
      recipient,
      channel: "sms",
      templateKey: rendered.template.key,
      payload: { body: rendered.body },
      dispatchAt: new Date(sentAt.getTime() + step.delayDays * 24 * 60 * 60 * 1000),
      idempotencyKey: `quote:${quote.id}:chase:${step.key}`,
      isTest: quote.is_demo === true,
      metadata: {
        sequence: "quote_chase",
        quote_id: quote.id,
        customer_id: quote.customer?.id ?? null,
        step: step.key,
      },
    });
  }

  return { scheduled: QUOTE_CHASE_STEPS.length, skipped: null };
}
