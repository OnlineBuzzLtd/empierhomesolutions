import { NextResponse } from "next/server";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import {
  getReviewRedirectUrl,
  hashFeedbackToken,
  verifyFeedbackToken,
} from "@/modules/crm/notifications/review-requests";

type FeedbackRequestRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  job_id: string | null;
  expires_at: string;
  used_at: string | null;
};

function getBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const baseUrl = getBaseUrl(request);
  if (!verifyFeedbackToken(token)) {
    return NextResponse.redirect(`${baseUrl}/feedback/thanks?status=invalid`, 303);
  }

  const formData = await request.formData();
  const score = Number(formData.get("score"));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.redirect(`${baseUrl}/feedback/thanks?status=invalid`, 303);
  }

  const supabase = createCrmServiceRoleClient();
  const { data: requestRow, error: requestError } = await supabase
    .schema("crm")
    .from("feedback_requests")
    .select("id, tenant_id, customer_id, job_id, expires_at, used_at")
    .eq("token_hash", hashFeedbackToken(token))
    .maybeSingle<FeedbackRequestRow>();

  if (requestError || !requestRow || requestRow.used_at || new Date(requestRow.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(`${baseUrl}/feedback/thanks?status=invalid`, 303);
  }

  const { data: settings } = await supabase
    .schema("crm")
    .from("tenant_settings")
    .select("review_requests_enabled, review_primary_platform, review_google_place_id, review_trustpilot_url, review_facebook_url")
    .eq("tenant_id", requestRow.tenant_id)
    .maybeSingle();
  const redirectUrl = score >= 4 ? getReviewRedirectUrl(settings) : null;

  const { error: responseError } = await supabase.schema("crm").from("feedback_responses").insert({
    tenant_id: requestRow.tenant_id,
    request_id: requestRow.id,
    customer_id: requestRow.customer_id,
    job_id: requestRow.job_id,
    score,
    comment: comment || null,
    redirect_url: redirectUrl,
  });
  if (responseError) {
    return NextResponse.redirect(`${baseUrl}/feedback/thanks?status=invalid`, 303);
  }

  await supabase
    .schema("crm")
    .from("feedback_requests")
    .update({ used_at: new Date().toISOString() })
    .eq("id", requestRow.id);

  if (score <= 3) {
    if (requestRow.customer_id) {
      await supabase
        .schema("crm")
        .from("customers")
        .update({ requires_call: true })
        .eq("id", requestRow.customer_id)
        .eq("tenant_id", requestRow.tenant_id);
    }
    if (requestRow.job_id) {
      await supabase.schema("crm").from("notes").insert({
        tenant_id: requestRow.tenant_id,
        entity_type: "job",
        entity_id: requestRow.job_id,
        body: `Low feedback score received: ${score}/5${comment ? ` - ${comment}` : ""}`,
        created_by: null,
      });
    }
    return NextResponse.redirect(`${baseUrl}/feedback/thanks?status=received`, 303);
  }

  return NextResponse.redirect(redirectUrl ?? `${baseUrl}/feedback/thanks?status=received`, 303);
}
