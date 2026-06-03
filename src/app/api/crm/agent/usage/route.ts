import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export const runtime = "nodejs";

const usageSchema = z.object({
  workspaceId: z.uuid().optional().nullable(),
  conversationId: z.uuid().optional().nullable(),
  traceId: z.string().trim().max(200).optional().nullable(),
  model: z.string().trim().max(100).optional().nullable(),
  toolName: z.string().trim().max(100).optional().nullable(),
  durationMs: z.number().int().nonnegative().optional().nullable(),
  tokensTotal: z.number().int().nonnegative().optional().nullable(),
  costEstimate: z.number().nonnegative().optional().nullable(),
  status: z.enum(["ok", "timeout", "fallback", "error"]).default("ok"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export async function GET() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("agent_usage_events")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ usage: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, usageSchema);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid usage telemetry payload.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("agent_usage_events")
    .insert({
      tenant_id: tenant.id,
      workspace_id: parsed.data.workspaceId ?? null,
      conversation_id: parsed.data.conversationId ?? null,
      trace_id: parsed.data.traceId ?? null,
      model: parsed.data.model ?? null,
      tool_name: parsed.data.toolName ?? null,
      duration_ms: parsed.data.durationMs ?? null,
      tokens_total: parsed.data.tokensTotal ?? null,
      cost_estimate: parsed.data.costEstimate ?? null,
      status: parsed.data.status,
      metadata: parsed.data.metadata,
      occurred_at: parsed.data.occurredAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ usage: data });
}
