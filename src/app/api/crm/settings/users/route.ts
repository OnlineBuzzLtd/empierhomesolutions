import { z } from "zod";
import { crmRoles } from "@/modules/crm/types";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

const userRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(crmRoles),
  full_name: z.string().optional(),
  phone: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = userRoleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid user profile payload.");
    }

    const auth = await requireManagerCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase } = auth.session;
    const payload = {
      user_id: parsed.data.user_id,
      role: parsed.data.role,
      full_name: parsed.data.full_name ?? "Team Member",
      phone: parsed.data.phone ?? null,
    };

    const { data, error } = await supabase
      .schema("crm")
      .from("user_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ profile: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save user role.", 400);
  }
}
