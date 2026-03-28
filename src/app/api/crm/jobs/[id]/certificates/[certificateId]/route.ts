import { jobCertificateSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; certificateId: string }> }) {
  try {
    const { id, certificateId } = await params;
    const body = normalizeBlankFields(await request.json(), ["certificate_number", "issued_at", "file_url"]);
    const parsed = jobCertificateSchema.partial().safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid certificate payload.");
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase } = auth.session;
    const { data, error } = await supabase.schema("crm").from("job_certificates").update(parsed.data).eq("job_id", id).eq("id", certificateId).select("*").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ certificate: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update certificate.", 400);
  }
}
