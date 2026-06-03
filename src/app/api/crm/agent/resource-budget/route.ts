import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export const runtime = "nodejs";

const budgetSchema = z.object({
  monthlyCostLimit: z.number().nonnegative().nullable().optional(),
  warningThresholdPercent: z.number().int().min(1).max(100).default(80),
  modelPolicy: z.enum(["quality_first", "balanced", "cost_sensitive"]).default("balanced"),
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
    .from("agent_resource_budgets")
    .select("*")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ budget: data ?? null });
}

export async function PUT(request: Request) {
  const parsed = await parseJsonBody(request, budgetSchema);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid resource budget payload.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("agent_resource_budgets")
    .upsert({
      tenant_id: tenant.id,
      monthly_cost_limit: parsed.data.monthlyCostLimit ?? null,
      warning_threshold_percent: parsed.data.warningThresholdPercent,
      model_policy: parsed.data.modelPolicy,
      metadata: parsed.data.metadata,
    }, { onConflict: "tenant_id" })
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ budget: data });
}
