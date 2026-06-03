import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export const runtime = "nodejs";

const discoverySchema = z.object({
  clusterType: z.enum(["unknown_intent", "missing_knowledge", "tool_failure", "low_confidence", "review_spike"]),
  title: z.string().trim().min(1).max(200),
  status: z.enum(["open", "accepted", "ignored", "converted_to_ticket"]).default("open"),
  priorityScore: z.number().int().nonnegative().default(0),
  sampleRefs: z.array(z.string().trim().min(1)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("agent_discovery_items")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ items: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, discoverySchema);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid discovery item payload.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("agent_discovery_items")
    .insert({
      tenant_id: tenant.id,
      cluster_type: parsed.data.clusterType,
      title: parsed.data.title,
      status: parsed.data.status,
      priority_score: parsed.data.priorityScore,
      sample_refs: parsed.data.sampleRefs,
      metadata: parsed.data.metadata,
    })
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ item: data });
}
