import { cookies } from "next/headers";
import { z } from "zod";
import { getServerEnv, publicEnv } from "@/lib/env";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { jsonError, jsonSuccess } from "@/modules/crm/lib/api";
import { crmActiveTenantCookieName } from "@/modules/crm/lib/auth";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { createTenantWorkspace } from "@/modules/crm/lib/tenants";
import { loadTenantBranding, sendTenantEmail } from "@/modules/crm/lib/emailer";
import { NextResponse } from "next/server";

/**
 * Signup hardening:
 *  - SIGNUP_MODE=invite (default) blocks public signups entirely. Flip to
 *    `public` only after the signup wizard + Turnstile + email-verification
 *    machinery has been validated in a staging environment.
 *  - Per-IP + per-email rate limit via @upstash/ratelimit (with in-memory
 *    fallback for dev).
 *  - Cloudflare Turnstile token verification (fail-closed in production).
 *  - Supabase auth user is created with email confirmation required. The
 *    tenant workspace is NOT provisioned at signup time; the first
 *    authenticated visit after confirmation is what bootstraps the workspace
 *    (see /api/crm/onboarding/complete).
 */
const signupSchema = z.object({
  business_name: z.string().min(2, "Business name is required."),
  slug: z
    .string()
    .min(2, "Workspace slug is required.")
    .regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and hyphens only."),
  full_name: z.string().min(2, "Your name is required."),
  email: z.string().email("A valid email address is required."),
  password: z.string().min(12, "Password must be at least 12 characters."),
  primary_phone: z.string().optional().nullable(),
  support_email: z.string().email().optional().or(z.literal("")).nullable(),
  legal_name: z.string().optional().nullable(),
  vat_registration_number: z.string().optional().nullable(),
  gas_safe_number: z.string().optional().nullable(),
  turnstileToken: z.string().optional(),
  // Invite code lets invite-mode tenants shortcut the public signup when the
  // operator team hand-creates an org. When SIGNUP_MODE=invite the code MUST
  // be a match for process.env.SIGNUP_INVITE_CODE.
  invite_code: z.string().optional(),
});

export async function POST(request: Request) {
  const env = getServerEnv();
  const ip = getClientIp(request);

  // Per-IP rate limit first (before we touch Supabase or Turnstile).
  const ipDecision = await consumeRateLimit(`signup:ip:${ip}`, {
    tokens: 5,
    window: "10 m",
    prefix: "rl:signup",
  });
  if (!ipDecision.ok) {
    return NextResponse.json(
      { error: "Too many signup attempts from this network. Please try again later." },
      { status: 429, headers: rateLimitHeaders(ipDecision) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid signup payload.");
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid signup payload.");
  }

  // Per-email rate limit — slower window, prevents enumeration.
  const emailKey = parsed.data.email.trim().toLowerCase();
  const emailDecision = await consumeRateLimit(`signup:email:${emailKey}`, {
    tokens: 3,
    window: "1 h",
    prefix: "rl:signup",
  });
  if (!emailDecision.ok) {
    return NextResponse.json(
      { error: "Too many signup attempts for this email. Please try again in an hour." },
      { status: 429, headers: rateLimitHeaders(emailDecision) },
    );
  }

  // Invite gate.
  if (env.signupMode === "invite") {
    const requiredCode = process.env.SIGNUP_INVITE_CODE;
    if (!requiredCode || parsed.data.invite_code !== requiredCode) {
      return jsonError(
        "Public signups are currently invite-only. Contact support@customerjourneys.ai for access.",
        403,
      );
    }
  }

  // Turnstile verification.
  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken ?? null, ip === "unknown" ? null : ip);
  if (!turnstile.ok) {
    return jsonError("Could not verify you are human. Please reload and try again.", 403);
  }

  let createdUserId: string | null = null;

  try {
    const admin = createCrmServiceRoleClient();
    const nextSupportEmail = parsed.data.support_email?.trim() || parsed.data.email;

    // Do NOT set email_confirm: true — the user has to click the magic link
    // in their inbox first. generateLink returns an action link the caller
    // would normally send via email, but Supabase's default SMTP pipeline
    // will already dispatch it because we didn't short-circuit confirmation.
    const { data: authUserData, error: authUserError } = await admin.auth.admin.createUser({
      email: parsed.data.email.trim(),
      password: parsed.data.password,
      email_confirm: false,
      user_metadata: {
        full_name: parsed.data.full_name.trim(),
        pending_workspace: {
          business_name: parsed.data.business_name,
          slug: parsed.data.slug,
          primary_phone: parsed.data.primary_phone ?? null,
          support_email: nextSupportEmail,
          legal_name: parsed.data.legal_name ?? null,
          vat_registration_number: parsed.data.vat_registration_number ?? null,
          gas_safe_number: parsed.data.gas_safe_number ?? null,
        },
      },
    });

    if (authUserError || !authUserData.user) {
      return jsonError(authUserError?.message ?? "Failed to create the workspace owner.", 400);
    }

    createdUserId = authUserData.user.id;

    // In invite mode we still provision eagerly (the invite code is the
    // trust boundary). In public mode we wait until the user confirms their
    // email and visits /api/crm/onboarding/complete.
    if (env.signupMode === "invite") {
      const result = await createTenantWorkspace(admin, {
        name: parsed.data.business_name,
        slug: parsed.data.slug,
        business_name: parsed.data.business_name,
        crm_display_name: `${parsed.data.business_name.trim()} CRM`,
        primary_phone: parsed.data.primary_phone,
        support_email: nextSupportEmail,
        legal_name: parsed.data.legal_name,
        vat_registration_number: parsed.data.vat_registration_number,
        gas_safe_number: parsed.data.gas_safe_number,
        clone_from_source: true,
        owner: {
          user: authUserData.user,
          role: "admin",
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          phone: parsed.data.primary_phone,
        },
      });

      const cookieStore = await cookies();
      cookieStore.set(crmActiveTenantCookieName, result.tenant.id, {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: env.isProduction,
        maxAge: 60 * 60 * 24 * 365,
      });

      // Fire-and-forget branded welcome — never block the signup response.
      try {
        const branding = await loadTenantBranding(admin, result.tenant.id);
        const loginUrl = `${publicEnv.siteUrl}/login`;
        const welcome = await sendTenantEmail({
          to: parsed.data.email.trim(),
          tag: "welcome",
          branding,
          subject: `Welcome to ${branding.tenantName ?? "your new workspace"}`,
          html: `<p>Hi ${parsed.data.full_name.trim()},</p>
            <p>Your ${branding.tenantName ?? "Customer Journeys"} workspace is ready.</p>
            <p><a href="${loginUrl}" style="background:${branding.primaryColor ?? "#0f172a"};color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">Open the CRM</a></p>
            <p>Bookmark your workspace: <a href="${loginUrl}">${loginUrl}</a></p>`,
          text: `Welcome to ${branding.tenantName ?? "your new workspace"}. Sign in at ${loginUrl}.`,
        });
        if (welcome.warning) {
          result.warnings.push(`[email:welcome] ${welcome.warning}`);
        }
      } catch (error) {
        result.warnings.push(
          error instanceof Error ? `[email:welcome] ${error.message}` : "[email:welcome] Failed to send welcome email.",
        );
      }

      return jsonSuccess({
        tenant: result.tenant,
        warnings: result.warnings,
        owner_email: parsed.data.email.trim(),
        mode: "invite",
      });
    }

    // Public mode: send verification email and stop. Do not provision the
    // tenant yet — that happens once the user confirms.
    const { error: inviteError } = await admin.auth.admin.generateLink({
      type: "signup",
      email: parsed.data.email.trim(),
      password: parsed.data.password,
      options: {
        redirectTo: `${publicEnv.siteUrl}/api/crm/onboarding/complete`,
      },
    });

    if (inviteError) {
      return jsonError(inviteError.message, 400);
    }

    return jsonSuccess({
      owner_email: parsed.data.email.trim(),
      mode: "public",
      awaiting_email_confirmation: true,
    });
  } catch (error) {
    if (createdUserId) {
      const admin = createCrmServiceRoleClient();
      await admin.auth.admin.deleteUser(createdUserId);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to create workspace.", 500);
  }
}
