import { jobCoolingOffConsentSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";
import { ensureTenantJob, officeCommercialRoles } from "@/modules/crm/lib/job-commercial-records";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser(officeCommercialRoles);
    if ("error" in auth) return auth.error;

    const body = normalizeBlankFields(await request.json(), [
      "contract_channel",
      "expires_at",
      "early_start_consent_at",
      "consent_method",
      "evidence_url",
      "notes",
    ]);
    const parsed = jobCoolingOffConsentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid cooling-off payload.");
    }

    const { supabase, tenant, user } = auth.session;
    if (!(await ensureTenantJob(supabase, tenant.id, id))) {
      return jsonError("Job not found.", 404);
    }

    const { data, error } = await supabase
      .schema("crm")
      .from("job_cooling_off_consents")
      .upsert(
        {
          tenant_id: tenant.id,
          job_id: id,
          ...parsed.data,
          evidence_url: parsed.data.evidence_url || null,
          created_by: resolveCreatedByUserId(user),
        },
        { onConflict: "job_id" },
      )
      .select("*")
      .single();
    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ cooling_off_consent: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save cooling-off consent.", 400);
  }
}
