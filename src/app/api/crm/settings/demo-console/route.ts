import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

// Toggle endpoint for crm.tenant_settings.demo_console_enabled (ticket
// F-1). Kept as its own route rather than folding into the existing
// /api/crm/settings/tenant upsert because the demo console capability
// is a distinct concern and we don't want a workspace-profile save to
// silently flip the demo gate.

const bodySchema = z.object({
  demo_console_enabled: z.preprocess(
    (v) => (v === "on" || v === "true" || v === true ? true : false),
    z.boolean(),
  ),
});

export async function POST(request: Request) {
  try {
    const auth = await requireManagerCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload.");
    }

    const { supabase, tenant } = auth.session;

    const { data, error } = await supabase
      .schema("crm")
      .from("tenant_settings")
      .upsert(
        {
          tenant_id: tenant.id,
          demo_console_enabled: parsed.data.demo_console_enabled,
        },
        { onConflict: "tenant_id" },
      )
      .select("demo_console_enabled")
      .single();

    if (error) {
      return jsonError(error.message ?? "Failed to update demo console setting.", 500);
    }

    return jsonSuccess({ demo_console_enabled: data.demo_console_enabled });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to update demo console setting.",
      500,
    );
  }
}
