import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { getFsmAdapter, type FsmProviderKey } from "@/modules/crm/integrations/fsm/registry";

const fsmSettingsSchema = z.object({
  fsm_provider: z.enum(["none", "servicem8", "joblogic"]).default("none"),
  api_key: z.string().optional().nullable(),
  account_id: z.string().optional().nullable(),
  base_url: z.string().url().optional().or(z.literal("")).nullable(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireManagerCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const parsed = fsmSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid FSM settings payload.");
    }

    const provider = parsed.data.fsm_provider as FsmProviderKey;
    const config =
      provider === "none"
        ? {}
        : {
            api_key: parsed.data.api_key?.trim() || null,
            account_id: parsed.data.account_id?.trim() || null,
            base_url: parsed.data.base_url?.trim() || null,
          };
    const adapter = getFsmAdapter(provider);
    const connection = await adapter.testConnection(config);

    const { supabase, tenant } = auth.session;
    const { data, error } = await supabase
      .schema("crm")
      .from("tenant_settings")
      .upsert(
        {
          tenant_id: tenant.id,
          fsm_provider: provider,
          fsm_config: config,
        },
        { onConflict: "tenant_id" },
      )
      .select("*")
      .single();
    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ settings: data, connection });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save FSM settings.", 500);
  }
}
