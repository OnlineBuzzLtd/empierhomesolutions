import { cookies } from "next/headers";
import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { crmActiveTenantCookieName } from "@/modules/crm/lib/auth";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { createTenantWorkspace } from "@/modules/crm/lib/tenants";

const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and hyphens only."),
  business_name: z.string().optional().nullable(),
  crm_display_name: z.string().optional().nullable(),
  primary_phone: z.string().optional().nullable(),
  support_email: z.string().email().optional().or(z.literal("")).nullable(),
  accent_color: z.string().optional().nullable(),
  legal_name: z.string().optional().nullable(),
  vat_registration_number: z.string().optional().nullable(),
  gas_safe_number: z.string().optional().nullable(),
  clone_from_current: z.coerce.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    const auth = await requireManagerCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid tenant onboarding payload.");
    }

    const { user, profile, tenant } = auth.session;
    const admin = createCrmServiceRoleClient();
    const result = await createTenantWorkspace(admin, {
      ...parsed.data,
      clone_from_source: parsed.data.clone_from_current,
      source_tenant_id: parsed.data.clone_from_current ? tenant.id : null,
      owner: {
        user,
        role: profile?.role ?? "admin",
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        email: profile?.email ?? user.email ?? null,
        emergency_contact: profile?.emergency_contact ?? null,
        agreed_hours: profile?.agreed_hours ?? null,
        pay_type: profile?.pay_type ?? null,
        pay_notes: profile?.pay_notes ?? null,
        contract_file_url: profile?.contract_file_url ?? null,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(crmActiveTenantCookieName, result.tenant.id, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
    });

    return jsonSuccess({
      tenant: result.tenant,
      warnings: result.warnings,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create tenant.", 500);
  }
}
