import { cookies } from "next/headers";
import { z } from "zod";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { crmActiveTenantCookieName } from "@/modules/crm/lib/auth";

const activeTenantSchema = z.object({
  tenant_id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const parsed = activeTenantSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid tenant selection.");
    }

    const { tenant_id } = parsed.data;
    const isAllowed = auth.session.membership.tenant_id === tenant_id;

    if (!isAllowed) {
      const { supabase, user } = auth.session;
      const { data: membership } = await supabase
        .schema("crm")
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("tenant_id", tenant_id)
        .eq("active", true)
        .maybeSingle();

      if (!membership) {
        return jsonError("You do not have access to that workspace.", 403);
      }
    }

    const cookieStore = await cookies();
    cookieStore.set(crmActiveTenantCookieName, tenant_id, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
    });

    return jsonSuccess({ tenant_id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to switch workspace.", 500);
  }
}
