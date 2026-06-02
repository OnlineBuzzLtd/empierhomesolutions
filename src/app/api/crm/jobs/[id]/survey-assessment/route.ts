import { jobSurveyAssessmentSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";
import { ensureTenantJob, fieldSurveyRoles } from "@/modules/crm/lib/job-commercial-records";
import { draftQuoteForJob, type QuoteAutomationResult } from "@/modules/crm/lib/quote-automation";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser(fieldSurveyRoles);
    if ("error" in auth) return auth.error;

    const body = normalizeBlankFields(await request.json(), [
      "boiler_type",
      "boiler_model",
      "flue_route",
      "gas_pipe_notes",
      "condensate_notes",
      "water_pressure_notes",
      "radiator_notes",
      "controls_notes",
      "access_notes",
      "parts_notes",
      "risk_notes",
      "engineer_notes",
    ]);
    const parsed = jobSurveyAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid survey assessment payload.");
    }

    const { supabase, tenant, user } = auth.session;
    if (!(await ensureTenantJob(supabase, tenant.id, id))) {
      return jsonError("Job not found.", 404);
    }

    const completedAt = parsed.data.status === "completed" ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .schema("crm")
      .from("job_survey_assessments")
      .upsert(
        {
          tenant_id: tenant.id,
          job_id: id,
          ...parsed.data,
          completed_at: completedAt,
          created_by: resolveCreatedByUserId(user),
        },
        { onConflict: "job_id" },
      )
      .select("*")
      .single();
    if (error) {
      return jsonError(error.message, 500);
    }

    let quoteAutomation: QuoteAutomationResult | null = null;
    if (parsed.data.status === "completed") {
      await supabase
        .schema("crm")
        .from("jobs")
        .update({ commercial_stage: "survey_done" })
        .eq("tenant_id", tenant.id)
        .eq("id", id);

      try {
        quoteAutomation = await draftQuoteForJob({
          supabase,
          tenantId: tenant.id,
          jobId: id,
          actorId: resolveCreatedByUserId(user),
          triggerSource: "survey_completed",
        });
      } catch (error) {
        console.error("[crm.survey_assessment] quote automation failed", {
          tenant_id: tenant.id,
          job_id: id,
          error: error instanceof Error ? error.message : String(error),
        });
        quoteAutomation = {
          status: "blocked",
          quoteId: null,
          invoiceScheduleIds: [],
          blockers: [
            {
              code: "automation_failed",
              message: error instanceof Error ? error.message : "Quote automation failed after survey save.",
            },
          ],
          warnings: ["Survey was saved, but quote automation failed."],
          automationMetadata: { trigger_source: "survey_completed", job_id: id },
        };
      }
    }

    return jsonSuccess({ survey_assessment: data, quoteAutomation });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save survey assessment.", 400);
  }
}
