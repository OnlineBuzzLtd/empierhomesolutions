import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { redactAgentEvalSnapshot } from "@/modules/platform/lib/agent-operations";

export const runtime = "nodejs";

const evalFixtureSchema = z.object({
  sourceFeedbackId: z.uuid().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  inputSnapshot: z.record(z.string(), z.unknown()).default({}),
  expectedOutcome: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("agent_eval_fixtures")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ fixtures: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, evalFixtureSchema);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid eval fixture payload.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant, user } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("agent_eval_fixtures")
    .insert({
      tenant_id: tenant.id,
      source_feedback_id: parsed.data.sourceFeedbackId ?? null,
      name: parsed.data.name,
      input_snapshot: redactAgentEvalSnapshot(parsed.data.inputSnapshot),
      expected_outcome: redactAgentEvalSnapshot(parsed.data.expectedOutcome),
      created_by_user_id: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ fixture: data });
}
