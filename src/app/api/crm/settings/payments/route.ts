import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { getPaymentProvider, type PaymentProviderKey } from "@/modules/crm/integrations/payments/registry";

const paymentSettingsSchema = z.object({
  payment_primary_provider: z.enum(["none", "stripe", "gocardless"]).default("none"),
  stripe_account_id: z.string().optional().nullable(),
  gocardless_merchant_id: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireManagerCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const parsed = paymentSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid payment settings payload.");
    }

    const provider = parsed.data.payment_primary_provider as PaymentProviderKey;
    const providerStatus = getPaymentProvider(provider).isConfigured({
      stripe_account_id: parsed.data.stripe_account_id?.trim() || null,
      gocardless_merchant_id: parsed.data.gocardless_merchant_id?.trim() || null,
    });

    const { supabase, tenant } = auth.session;
    const { data, error } = await supabase
      .schema("crm")
      .from("tenant_settings")
      .upsert(
        {
          tenant_id: tenant.id,
          payment_primary_provider: provider,
          stripe_account_id: parsed.data.stripe_account_id?.trim() || null,
          gocardless_merchant_id: parsed.data.gocardless_merchant_id?.trim() || null,
        },
        { onConflict: "tenant_id" },
      )
      .select("*")
      .single();
    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ settings: data, configured: providerStatus });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save payment settings.", 500);
  }
}
