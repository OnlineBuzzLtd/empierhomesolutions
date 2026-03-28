import { cookies } from "next/headers";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/modules/crm/lib/api";
import { crmActiveTenantCookieName } from "@/modules/crm/lib/auth";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { createTenantWorkspace } from "@/modules/crm/lib/tenants";

const signupSchema = z.object({
  business_name: z.string().min(2, "Business name is required."),
  slug: z
    .string()
    .min(2, "Workspace slug is required.")
    .regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and hyphens only."),
  full_name: z.string().min(2, "Your name is required."),
  email: z.string().email("A valid email address is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  primary_phone: z.string().optional().nullable(),
  support_email: z.string().email().optional().or(z.literal("")).nullable(),
  legal_name: z.string().optional().nullable(),
  vat_registration_number: z.string().optional().nullable(),
  gas_safe_number: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid signup payload.");
    }

    const admin = createCrmServiceRoleClient();
    const nextSupportEmail = parsed.data.support_email?.trim() || parsed.data.email;
    const { data: authUserData, error: authUserError } = await admin.auth.admin.createUser({
      email: parsed.data.email.trim(),
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.full_name.trim(),
      },
    });

    if (authUserError || !authUserData.user) {
      return jsonError(authUserError?.message ?? "Failed to create the workspace owner.", 400);
    }

    createdUserId = authUserData.user.id;
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
      maxAge: 60 * 60 * 24 * 365,
    });

    return jsonSuccess({
      tenant: result.tenant,
      warnings: result.warnings,
      owner_email: parsed.data.email.trim(),
    });
  } catch (error) {
    if (createdUserId) {
      const admin = createCrmServiceRoleClient();
      await admin.auth.admin.deleteUser(createdUserId);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to create workspace.", 500);
  }
}
