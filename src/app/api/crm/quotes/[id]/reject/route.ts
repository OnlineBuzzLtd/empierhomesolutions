import { quoteRejectionSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const parsed = quoteRejectionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid rejection payload.");
    }

    const { supabase } = auth.session;
    const { data, error } = await supabase
      .schema("crm")
      .from("quotes")
      .update({
        status: "declined",
        rejected_at: new Date().toISOString(),
        rejection_reason: parsed.data.reason,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      return jsonError(error.message, 500);
    }
    return jsonSuccess({ quote: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to reject quote.", 500);
  }
}
