import { z } from "zod";
import { jsonError, jsonSuccess, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";
import { draftQuoteForJob } from "@/modules/crm/lib/quote-automation";

const bodySchema = z.object({
  force: z.boolean().optional().default(true),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser(["management", "admin", "sales", "accounts"]);
    if ("error" in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid quote automation payload.");
    }

    const { supabase, tenant, user } = auth.session;
    const result = await draftQuoteForJob({
      supabase,
      tenantId: tenant.id,
      jobId: id,
      actorId: resolveCreatedByUserId(user),
      triggerSource: "manual",
      force: parsed.data.force,
    });

    return jsonSuccess({ quoteAutomation: result });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to draft quote.", 500);
  }
}
