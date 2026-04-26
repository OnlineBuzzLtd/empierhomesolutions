// Per-tenant transactional email.
//
// Phase 3.4 wires signup + lifecycle flows through a thin provider
// abstraction (Resend today, Postmark compatible) so branding — accent
// colour, logo, support email — can be pulled from
// `crm.tenant_branding` and injected into every message.
//
// We deliberately avoid adding a new SDK dependency and hit the REST
// API directly. Failure is fire-and-forget: email outages must never
// block signup or admin operations.

import type { SupabaseClient } from "@supabase/supabase-js";

type Provider = "resend" | "postmark" | null;

type BrandingSnapshot = {
  tenantId?: string | null;
  tenantName?: string | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
  supportEmail?: string | null;
  fromName?: string | null;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  branding?: BrandingSnapshot;
  tag?: string;
};

function resolveProvider(): Provider {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.POSTMARK_API_KEY) return "postmark";
  return null;
}

function defaultFromAddress(branding: BrandingSnapshot | undefined): string {
  const fallback = process.env.CRM_TRANSACTIONAL_FROM ?? "Customer Journeys <noreply@customerjourneys.ai>";
  if (!branding) return fallback;
  const name = branding.fromName ?? branding.tenantName ?? "Customer Journeys";
  const address = process.env.CRM_TRANSACTIONAL_FROM_ADDRESS ?? "noreply@customerjourneys.ai";
  return `${name} <${address}>`;
}

function wrapHtml(input: string, branding: BrandingSnapshot | undefined): string {
  const accent = branding?.primaryColor ?? "#0f172a";
  const logo = branding?.logoUrl ?? null;
  const support = branding?.supportEmail ?? process.env.SUPPORT_EMAIL ?? "support@customerjourneys.ai";
  const name = branding?.tenantName ?? "Customer Journeys";
  const logoBlock = logo
    ? `<div style="text-align:center;padding:24px 0;"><img src="${logo}" alt="${name}" style="max-height:40px;"/></div>`
    : `<div style="text-align:center;padding:24px 0;font-weight:600;color:${accent};">${name}</div>`;
  return `<!doctype html>
<html>
<body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    ${logoBlock}
    <div style="padding:0 32px 32px 32px;line-height:1.55;">${input}</div>
    <div style="padding:16px 32px 32px 32px;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;">
      Need help? Email <a style="color:${accent};" href="mailto:${support}">${support}</a>.
    </div>
  </div>
</body>
</html>`;
}

async function sendViaResend(payload: {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  tag?: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      tags: payload.tag ? [{ name: "category", value: payload.tag }] : undefined,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function sendViaPostmark(payload: {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  tag?: string;
}) {
  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-postmark-server-token": process.env.POSTMARK_API_KEY ?? "",
    },
    body: JSON.stringify({
      From: payload.from,
      To: payload.to,
      Subject: payload.subject,
      HtmlBody: payload.html,
      TextBody: payload.text,
      Tag: payload.tag,
      MessageStream: process.env.POSTMARK_STREAM ?? "outbound",
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Postmark ${response.status}: ${body.slice(0, 200)}`);
  }
}

export async function sendTenantEmail(input: SendEmailInput): Promise<{ ok: boolean; warning?: string }> {
  const provider = resolveProvider();
  if (!provider) {
    return { ok: false, warning: "No transactional email provider configured (RESEND_API_KEY / POSTMARK_API_KEY)." };
  }

  const from = defaultFromAddress(input.branding);
  const html = input.html ? wrapHtml(input.html, input.branding) : undefined;

  try {
    if (provider === "resend") {
      await sendViaResend({ from, to: input.to, subject: input.subject, html, text: input.text, tag: input.tag });
    } else {
      await sendViaPostmark({ from, to: input.to, subject: input.subject, html, text: input.text, tag: input.tag });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, warning: error instanceof Error ? error.message : "Transactional email send failed." };
  }
}

export async function loadTenantBranding(
  admin: SupabaseClient,
  tenantId: string,
): Promise<BrandingSnapshot> {
  const [{ data: tenant }, { data: branding }] = await Promise.all([
    admin.schema("crm").from("tenants").select("id, name").eq("id", tenantId).maybeSingle(),
    admin
      .schema("crm")
      .from("tenant_branding")
      .select("accent_color, logo_url, support_email, business_name")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);
  return {
    tenantId,
    tenantName: (branding?.business_name as string | null) ?? tenant?.name ?? null,
    primaryColor: (branding?.accent_color as string | null) ?? null,
    logoUrl: (branding?.logo_url as string | null) ?? null,
    supportEmail: (branding?.support_email as string | null) ?? null,
    fromName: (branding?.business_name as string | null) ?? tenant?.name ?? null,
  };
}
