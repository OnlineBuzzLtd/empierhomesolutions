import { jobComplianceCloseoutSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";
import { ensureTenantJob, fieldSurveyRoles } from "@/modules/crm/lib/job-commercial-records";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser(fieldSurveyRoles);
    if ("error" in auth) return auth.error;

    const body = normalizeBlankFields(await request.json(), [
      "building_regs_notification_due_at",
      "building_regs_notified_at",
      "gas_safe_reference",
      "certificate_received_at",
      "certificate_sent_at",
      "evidence_url",
      "notes",
    ]);
    const parsed = jobComplianceCloseoutSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid compliance closeout payload.");
    }

    const { supabase, tenant, user } = auth.session;
    if (!(await ensureTenantJob(supabase, tenant.id, id))) {
      return jsonError("Job not found.", 404);
    }

    const { data, error } = await supabase
      .schema("crm")
      .from("job_compliance_closeouts")
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

    return jsonSuccess({ compliance_closeout: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save compliance closeout.", 400);
  }
}
