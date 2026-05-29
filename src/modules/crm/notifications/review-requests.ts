import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderNotificationTemplate } from "@/modules/crm/notifications/render";
import { scheduleNotification } from "@/modules/crm/notifications/scheduler";

type ReviewSettings = {
  review_google_place_id?: string | null;
  review_trustpilot_url?: string | null;
  review_facebook_url?: string | null;
  review_primary_platform?: string | null;
  review_requests_enabled?: boolean | null;
};

type ReviewJobRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  title: string;
  is_demo?: boolean | null;
  customer?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
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

function getTokenSecret() {
  return process.env.FEEDBACK_TOKEN_SECRET ?? process.env.CRON_SECRET ?? "dev-feedback-token-secret";
}

function signToken(id: string) {
  return createHmac("sha256", getTokenSecret()).update(id).digest("base64url");
}

export function mintFeedbackToken() {
  const id = randomBytes(24).toString("base64url");
  return `${id}.${signToken(id)}`;
}

export function verifyFeedbackToken(token: string) {
  const [id, signature] = token.split(".");
  if (!id || !signature) {
    return false;
  }
  const expected = signToken(id);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function hashFeedbackToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getReviewRedirectUrl(settings: ReviewSettings | null | undefined) {
  if (!settings?.review_requests_enabled) {
    return null;
  }

  switch (settings.review_primary_platform) {
    case "google":
      return settings.review_google_place_id
        ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(settings.review_google_place_id)}`
        : null;
    case "trustpilot":
      return settings.review_trustpilot_url?.trim() || null;
    case "facebook":
      return settings.review_facebook_url?.trim() || null;
    default:
      return null;
  }
}

async function createFeedbackRequest(
  supabase: SupabaseClient,
  input: { tenantId: string; customerId: string | null; jobId: string; channel: "sms" | "email" | "mixed"; token: string },
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("feedback_requests")
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      job_id: input.jobId,
      channel: input.channel,
      token_hash: hashFeedbackToken(input.token),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return String(data.id);
}

export async function scheduleReviewRequestsForCompletedJob(
  supabase: SupabaseClient,
  input: { tenantId: string; jobId: string; completedAt?: Date },
) {
  const [{ data: existing, error: existingError }, { data: settings, error: settingsError }, { data, error }] =
    await Promise.all([
      supabase
        .schema("crm")
        .from("feedback_requests")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("job_id", input.jobId)
        .limit(1),
      supabase
        .schema("crm")
        .from("tenant_settings")
        .select("review_requests_enabled, review_primary_platform, review_google_place_id, review_trustpilot_url, review_facebook_url")
        .eq("tenant_id", input.tenantId)
        .maybeSingle(),
      supabase
        .schema("crm")
        .from("jobs")
        .select("id, tenant_id, customer_id, title, is_demo, customer:customers(id, full_name, phone, email)")
        .eq("tenant_id", input.tenantId)
        .eq("id", input.jobId)
        .maybeSingle(),
    ]);

  if (existingError || settingsError || error) {
    throw existingError ?? settingsError ?? error;
  }
  if ((existing ?? []).length > 0) {
    return { scheduled: 0, skipped: "already_requested" };
  }
  if (!getReviewRedirectUrl(settings as ReviewSettings | null)) {
    return { scheduled: 0, skipped: "review_config_missing" };
  }
  if (!data) {
    return { scheduled: 0, skipped: "job_not_found" };
  }

  const row = data as unknown as Omit<ReviewJobRow, "customer"> & {
    customer: SupabaseRelation<NonNullable<ReviewJobRow["customer"]>>;
  };
  const job: ReviewJobRow = { ...row, customer: firstRelation(row.customer) };
  const customer = job.customer;
  if (!customer?.phone && !customer?.email) {
    return { scheduled: 0, skipped: "missing_customer_contact" };
  }

  const token = mintFeedbackToken();
  const requestId = await createFeedbackRequest(supabase, {
    tenantId: input.tenantId,
    customerId: customer.id,
    jobId: job.id,
    channel: customer.phone && customer.email ? "mixed" : customer.phone ? "sms" : "email",
    token,
  });

  const feedbackLink = `${getBaseUrl()}/feedback/${encodeURIComponent(token)}`;
  const variables = {
    customer_name: customer.full_name?.trim() || "there",
    feedback_link: feedbackLink,
  };
  const dispatchAt = new Date((input.completedAt ?? new Date()).getTime() + 2 * 60 * 60 * 1000);
  let scheduled = 0;

  if (customer.phone) {
    const rendered = await renderNotificationTemplate(supabase, {
      tenantId: input.tenantId,
      key: "review_request_sms",
      channel: "sms",
      variables,
    });
    await scheduleNotification(supabase, {
      tenantId: input.tenantId,
      recipient: customer.phone,
      channel: "sms",
      templateKey: rendered.template.key,
      payload: { body: rendered.body },
      dispatchAt,
      idempotencyKey: `job:${job.id}:review_request:sms`,
      isTest: job.is_demo === true,
      metadata: {
        sequence: "review_request",
        request_id: requestId,
        job_id: job.id,
        customer_id: customer.id,
        channel: "sms",
      },
    });
    scheduled += 1;
  }

  if (customer.email) {
    const rendered = await renderNotificationTemplate(supabase, {
      tenantId: input.tenantId,
      key: "review_request_email",
      channel: "email",
      variables,
    });
    await scheduleNotification(supabase, {
      tenantId: input.tenantId,
      recipient: customer.email,
      channel: "email",
      templateKey: rendered.template.key,
      payload: {
        subject: rendered.subject ?? "How did we do?",
        html: rendered.body,
      },
      dispatchAt,
      idempotencyKey: `job:${job.id}:review_request:email`,
      isTest: job.is_demo === true,
      metadata: {
        sequence: "review_request",
        request_id: requestId,
        job_id: job.id,
        customer_id: customer.id,
        channel: "email",
      },
    });
    scheduled += 1;
  }

  return { scheduled, skipped: null };
}
