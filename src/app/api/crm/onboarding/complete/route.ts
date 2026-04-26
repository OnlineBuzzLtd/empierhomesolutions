import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerEnv, publicEnv } from "@/lib/env";
import { jsonError } from "@/modules/crm/lib/api";
import { crmActiveTenantCookieName } from "@/modules/crm/lib/auth";
import { createCrmServerClient, createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { createTenantWorkspace } from "@/modules/crm/lib/tenants";

type PendingWorkspaceMetadata = {
  business_name: string;
  slug: string;
  primary_phone?: string | null;
  support_email?: string | null;
  legal_name?: string | null;
  vat_registration_number?: string | null;
  gas_safe_number?: string | null;
};

/**
 * Callback hit by the magic-link email Supabase dispatches after a
 * public-mode signup. Supabase has already marked the auth user as
 * confirmed by the time we get here; our job is to:
 *   1. Verify a CRM server session exists for the confirmed user.
 *   2. Read their stored `pending_workspace` metadata.
 *   3. Call createTenantWorkspace() to clone the template + seed native
 *      calendar defaults (via the platform-api runtime link, which
 *      createTenantWorkspace is already responsible for).
 *   4. Set the active-tenant cookie and redirect into the CRM dashboard.
 *
 * If anything fails we surface a readable error page instead of silently
 * swallowing — the user must be able to see what happened and retry.
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  const url = new URL(request.url);

  const supabase = await createCrmServerClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    const loginUrl = new URL("/login", publicEnv.siteUrl);
    loginUrl.searchParams.set("next", "/api/crm/onboarding/complete");
    return NextResponse.redirect(loginUrl);
  }

  if (!user.email_confirmed_at) {
    return jsonError("Please click the verification link in your email first.", 400);
  }

  const pending = user.user_metadata?.pending_workspace as PendingWorkspaceMetadata | undefined;
  if (!pending?.business_name || !pending?.slug) {
    // Already provisioned or missing metadata — send them to dashboard and
    // let existing routing decide whether they have access.
    return NextResponse.redirect(new URL("/dashboard", publicEnv.siteUrl));
  }

  try {
    const admin = createCrmServiceRoleClient();
    const result = await createTenantWorkspace(admin, {
      name: pending.business_name,
      slug: pending.slug,
      business_name: pending.business_name,
      crm_display_name: `${pending.business_name.trim()} CRM`,
      primary_phone: pending.primary_phone ?? null,
      support_email: pending.support_email ?? user.email ?? null,
      legal_name: pending.legal_name ?? null,
      vat_registration_number: pending.vat_registration_number ?? null,
      gas_safe_number: pending.gas_safe_number ?? null,
      clone_from_source: true,
      owner: {
        user,
        role: "admin",
        full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Owner",
        email: user.email ?? "",
        phone: pending.primary_phone ?? null,
      },
    });

    // Clear the pending-workspace metadata so a subsequent callback is a
    // no-op instead of attempting a duplicate provision.
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        pending_workspace: null,
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

    const nextUrl = url.searchParams.get("next") ?? "/dashboard";
    return NextResponse.redirect(new URL(nextUrl, publicEnv.siteUrl));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to finish workspace setup.", 500);
  }
}
