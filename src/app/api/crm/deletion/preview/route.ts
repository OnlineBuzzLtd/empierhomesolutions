export const runtime = "nodejs";

import { z } from "zod";
import { buildDeleteTrailPlan, deleteTrailRootTypes } from "@/modules/crm/lib/delete-trail";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

const previewSchema = z.object({
  root_type: z.enum(deleteTrailRootTypes),
  root_id: z.string().trim().min(1, "Select a record to delete."),
});

export async function POST(request: Request) {
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid deletion preview payload.");
  }

  const auth = await requireCrmApiUser(["management", "admin"]);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const plan = await buildDeleteTrailPlan({
      supabase: auth.session.supabase,
      tenantId: auth.session.tenant.id,
      rootType: parsed.data.root_type,
      rootId: parsed.data.root_id,
    });
    return jsonSuccess({ plan });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not build deletion preview.", 500);
  }
}
