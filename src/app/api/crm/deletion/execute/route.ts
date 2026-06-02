export const runtime = "nodejs";

import { z } from "zod";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { deleteTrailRootTypes, executeDeleteTrailPlan } from "@/modules/crm/lib/delete-trail";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

const executeSchema = z.object({
  root_type: z.enum(deleteTrailRootTypes),
  root_id: z.string().trim().min(1, "Select a record to delete."),
  reason: z.string().trim().min(8, "Add a deletion reason with at least 8 characters."),
  plan_hash: z.string().trim().min(16, "Refresh the deletion preview before executing."),
  confirmation_phrase: z.string().trim().min(1, "Type the confirmation phrase to continue."),
});

export async function POST(request: Request) {
  if (!getCrmEnv().adminEnabled) {
    return jsonError("Supabase service role is required for CRM deletion.", 500);
  }

  const parsed = executeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid deletion payload.");
  }

  const auth = await requireCrmApiUser(["management", "admin"]);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const admin = createCrmServiceRoleClient();
    const result = await executeDeleteTrailPlan({
      supabase: admin,
      storageSupabase: admin,
      tenantId: auth.session.tenant.id,
      actorId: auth.session.user.id,
      rootType: parsed.data.root_type,
      rootId: parsed.data.root_id,
      reason: parsed.data.reason,
      planHash: parsed.data.plan_hash,
      confirmationPhrase: parsed.data.confirmation_phrase,
    });
    return jsonSuccess(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not delete CRM trail.", 400);
  }
}
