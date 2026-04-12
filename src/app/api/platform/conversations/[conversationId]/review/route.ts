import { z } from "zod";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getPlatformConversationLink, upsertPlatformConversationLink } from "@/modules/platform/lib/repository";

const reviewPayloadSchema = z.object({
  status: z.enum(["open", "in_progress"]).optional(),
  assignee_user_id: z.uuid().nullable().optional(),
  assignee_name: z.string().trim().max(200).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const auth = await requireCrmApiUser(["management", "admin", "sales", "accounts"]);
    if ("error" in auth) {
      return auth.error;
    }

    const params = await context.params;
    const conversationId = params.conversationId?.trim();
    if (!conversationId) {
      return jsonError("Conversation ID is required.");
    }

    const body = normalizeBlankFields(await request.json(), ["assignee_user_id", "assignee_name"]);
    const parsed = reviewPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid review payload.");
    }

    const { supabase, tenant, user, profile } = auth.session;
    const link = await getPlatformConversationLink(supabase, tenant.id, conversationId);
    if (!link) {
      return jsonError("Platform conversation link not found.", 404);
    }

    const nextStatus = parsed.data.status ?? "open";
    const assigneeUserId = parsed.data.assignee_user_id ?? null;
    const assigneeName = parsed.data.assignee_name ?? null;
    const nowIso = new Date().toISOString();

    const updatedLink = await upsertPlatformConversationLink(
      supabase,
      {
        workspace_id: link.workspace_id,
        tenant_id: tenant.id,
        created_at: link.created_at,
        updated_at: link.updated_at,
      },
      {
        conversationId,
        latestEventAt: link.latest_event_at,
        metadata: {
          review_status: nextStatus,
          review_assignee_user_id: assigneeUserId,
          review_assignee_name: assigneeName,
          review_assigned_at: assigneeUserId ? nowIso : null,
          review_updated_at: nowIso,
          review_updated_by: profile?.full_name ?? user.email ?? user.id,
        },
      },
    );

    return jsonSuccess({ link: updatedLink });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update conversation review state.", 400);
  }
}
