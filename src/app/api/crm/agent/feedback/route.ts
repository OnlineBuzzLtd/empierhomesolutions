import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  sourceType: z.enum(["manual_relink", "review_resolution", "booking_recovery", "dismissed_ai_outcome", "operator_note"]),
  sourceId: z.string().trim().max(200).optional().nullable(),
  rootIssueCategory: z.enum([
    "wrong_customer",
    "wrong_service",
    "missing_identity",
    "duplicate_booking",
    "failed_tool",
    "unsafe_low_confidence_answer",
    "unknown_intent",
    "other",
  ]),
  conversationId: z.uuid().optional().nullable(),
  eventId: z.uuid().optional().nullable(),
  commandId: z.uuid().optional().nullable(),
  traceId: z.string().trim().max(200).optional().nullable(),
  feedback: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, feedbackSchema);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid agent feedback payload.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant, user } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("agent_feedback_records")
    .insert({
      tenant_id: tenant.id,
      source_type: parsed.data.sourceType,
      source_id: parsed.data.sourceId ?? null,
      root_issue_category: parsed.data.rootIssueCategory,
      conversation_id: parsed.data.conversationId ?? null,
      event_id: parsed.data.eventId ?? null,
      command_id: parsed.data.commandId ?? null,
      trace_id: parsed.data.traceId ?? null,
      feedback: parsed.data.feedback,
      created_by_user_id: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ feedback: data });
}
