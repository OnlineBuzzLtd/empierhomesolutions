import { jobCertificateSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["certificate_number", "issued_at", "file_url"]);
    const parsed = jobCertificateSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid certificate payload.");
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase, tenant } = auth.session;
    const { data, error } = await supabase.schema("crm").from("job_certificates").insert({
      tenant_id: tenant.id,
      job_id: id,
      title: parsed.data.title,
      certificate_number: parsed.data.certificate_number ?? null,
      status: parsed.data.status,
      issued_at: parsed.data.issued_at ?? null,
      file_url: parsed.data.file_url ?? null,
    }).select("*").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ certificate: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create certificate.", 400);
  }
}
