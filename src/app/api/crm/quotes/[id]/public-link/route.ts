import { headers } from "next/headers";
import { publicLinkRequestSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { buildPublicLinkUrl, mintToken } from "@/modules/crm/lib/public-quote";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    let payload: { ttl_days?: number } = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }
    const parsed = publicLinkRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload.");
    }

    const { supabase } = auth.session;
    const { token, expires_at } = mintToken(parsed.data.ttl_days);
    const { error } = await supabase
      .schema("crm")
      .from("quotes")
      .update({ public_token: token, public_token_expires_at: expires_at })
      .eq("id", id);
    if (error) {
      return jsonError(error.message, 500);
    }

    const headerStore = await headers();
    const origin = headerStore.get("origin") ?? `https://${headerStore.get("host") ?? "localhost"}`;
    return jsonSuccess({ token, expires_at, url: buildPublicLinkUrl(origin, token) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to mint public link.", 500);
  }
}
