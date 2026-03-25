import { getAddonState, resolveEngineerAiAssistState } from "@/modules/crm/lib/addons";
import { jsonError, jsonSuccess, parseJsonBody, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getJobDetail } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { buildEngineerAiAssistDraft } from "@/modules/crm/lib/engineer-ai";
import { validateRequiredDocuments } from "@/modules/crm/lib/rules";
import { engineerAiAssistRequestSchema } from "@/modules/crm/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = await parseJsonBody(request, engineerAiAssistRequestSchema);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid AI assist request.");
    }

    const auth = await requireCrmApiUser(["engineer", "management", "admin"]);
    if ("error" in auth) {
      return auth.error;
    }

    const [{ id }, demoState, addon] = await Promise.all([params, getCrmDemoState(), getAddonState("ai_comms_hub")]);
    const aiAccess = resolveEngineerAiAssistState(addon, auth.session.profile?.role, demoState.active);
    if (aiAccess === "locked") {
      return jsonError("AI Assist is not enabled for this account.", 403);
    }

    const detail = await getJobDetail(id, demoState.mode);
    if (!detail) {
      return jsonError("Job not found.", 404);
    }

    const requiredDocuments = await validateRequiredDocuments({
      entityType: "job",
      entityId: detail.job.id,
      serviceId: detail.job.service_id,
      jobTypeId: detail.job.job_type_id,
      pipelineStage: detail.job.status,
    });

    const draft = buildEngineerAiAssistDraft(
      {
        job: detail.job,
        notes: detail.notes,
        attachments: detail.attachments,
        quote: detail.quote,
        invoice: detail.invoice,
        missingDocuments: requiredDocuments.missing,
      },
      parsed.data.action,
    );

    return jsonSuccess({ draft, access: aiAccess });
  } catch {
    return jsonError("AI Assist is unavailable right now.", 500);
  }
}
