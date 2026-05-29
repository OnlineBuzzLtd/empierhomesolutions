import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

const urlOrBlank = z.string().url().optional().or(z.literal("")).nullable();

const reviewSettingsSchema = z.object({
  review_requests_enabled: z
    .preprocess((value) => value === "on" || value === "true" || value === true, z.boolean())
    .optional(),
  review_primary_platform: z.enum(["none", "google", "trustpilot", "facebook"]).default("none"),
  review_google_place_id: z.string().optional().nullable(),
  review_trustpilot_url: urlOrBlank,
  review_facebook_url: urlOrBlank,
});

export async function POST(request: Request) {
  try {
    const auth = await requireManagerCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const parsed = reviewSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid review settings payload.");
    }

    const { supabase, tenant } = auth.session;
    const { data, error } = await supabase
      .schema("crm")
      .from("tenant_settings")
      .upsert(
        {
          tenant_id: tenant.id,
          review_requests_enabled: parsed.data.review_requests_enabled ?? false,
          review_primary_platform: parsed.data.review_primary_platform,
          review_google_place_id: parsed.data.review_google_place_id?.trim() || null,
          review_trustpilot_url: parsed.data.review_trustpilot_url?.trim() || null,
          review_facebook_url: parsed.data.review_facebook_url?.trim() || null,
        },
        { onConflict: "tenant_id" },
      )
      .select("*")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ settings: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save review settings.", 500);
  }
}
