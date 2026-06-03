import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export const runtime = "nodejs";

const knowledgeTypes = [
  "service",
  "price_range",
  "coverage_area",
  "opening_hours",
  "exclusion",
  "payment_policy",
  "cancellation_policy",
  "emergency_policy",
  "faq",
] as const;

const knowledgeSchema = z.object({
  knowledgeType: z.enum(knowledgeTypes),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  sourceVersion: z.string().trim().min(1).max(50).default("v1"),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const type = params.get("type");

  let builder = supabase
    .schema("crm")
    .from("agent_knowledge_sources")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (type && knowledgeTypes.includes(type as (typeof knowledgeTypes)[number])) {
    builder = builder.eq("knowledge_type", type);
  }
  if (query) {
    builder = builder.or(`title.ilike.%${query}%,body.ilike.%${query}%`);
  }

  const { data, error } = await builder;
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ sources: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, knowledgeSchema);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid knowledge source payload.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("agent_knowledge_sources")
    .insert({
      tenant_id: tenant.id,
      knowledge_type: parsed.data.knowledgeType,
      title: parsed.data.title,
      body: parsed.data.body,
      source_version: parsed.data.sourceVersion,
      active: parsed.data.active,
      metadata: parsed.data.metadata,
    })
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ source: data });
}
