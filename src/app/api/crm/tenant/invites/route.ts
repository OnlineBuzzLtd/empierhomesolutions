import { NextResponse } from "next/server";
import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { jsonError } from "@/modules/crm/lib/api";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { loadTenantBranding, sendTenantEmail } from "@/modules/crm/lib/emailer";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export const runtime = "nodejs";

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(120).optional(),
  role: z.enum(["admin", "management", "engineer", "staff"]).default("staff"),
});

// Tenant admin invites a colleague. The flow is invite-style: we call
// Supabase's admin invite API, then dispatch a branded follow-up email
// so the invite feels like it came from the tenant, not the generic
// Customer Journeys address.
export async function POST(request: Request) {
  const session = await requireSettingsAccess();
  if (!session.configured || !session.tenant) {
    return NextResponse.json({ error: "session_unavailable" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid invite payload.");
  }

  const admin = createCrmServiceRoleClient();
  const redirectTo = `${publicEnv.siteUrl}/onboarding/accept-invite?tenant=${session.tenant.id}`;

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email.trim(),
    {
      data: {
        invited_tenant_id: session.tenant.id,
        invited_role: parsed.data.role,
        full_name: parsed.data.full_name ?? null,
      },
      redirectTo,
    },
  );

  if (inviteError) {
    return jsonError(inviteError.message, 400);
  }

  if (inviteData.user?.id) {
    const { error: membershipError } = await admin
      .schema("crm")
      .from("tenant_memberships")
      .upsert(
        {
          tenant_id: session.tenant.id,
          user_id: inviteData.user.id,
          role: parsed.data.role,
          active: false,
          is_owner: false,
        },
        { onConflict: "tenant_id,user_id" },
      );
    if (membershipError) {
      return jsonError(membershipError.message, 500);
    }
  }

  // Branded follow-up. Supabase already sends a raw invite email; some
  // tenants prefer to disable that via SMTP config and rely solely on
  // this branded one. Either way this is idempotent and safe.
  try {
    const branding = await loadTenantBranding(admin, session.tenant.id);
    await sendTenantEmail({
      to: parsed.data.email.trim(),
      tag: "invite",
      branding,
      subject: `You're invited to ${branding.tenantName ?? "the CRM"}`,
      html: `<p>Hi${parsed.data.full_name ? ` ${parsed.data.full_name}` : ""},</p>
        <p>${session.profile?.full_name ?? "A teammate"} invited you to ${branding.tenantName ?? "the CRM"}.</p>
        <p>Check your inbox for the secure sign-in link from Supabase to finish setting up.</p>
        <p>If you were not expecting this, you can ignore this email.</p>`,
      text: `You have been invited to ${branding.tenantName ?? "the CRM"}. Check your inbox for the sign-in link.`,
    });
  } catch {
    // Best effort — don't fail the invite if branded email errors.
  }

  return NextResponse.json({ ok: true, invited_email: parsed.data.email.trim() });
}
