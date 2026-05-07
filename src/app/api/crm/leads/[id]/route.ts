import { leadSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { validateRequiredProgression } from "@/modules/crm/lib/rules";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { publishLeadUpdateToPlatform } from "@/modules/crm/lib/platform-sync";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = leadSchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid lead payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase } = auth.session;
  const { data: existing } = await supabase.schema("crm").from("leads").select("service_id, job_type_id, status").eq("id", id).single();

  if (existing && (parsed.data.status || parsed.data.service_id || parsed.data.job_type_id)) {
    const validation = await validateRequiredProgression({
      entityType: "lead",
      entityId: id,
      serviceId: parsed.data.service_id ?? existing?.service_id,
      jobTypeId: parsed.data.job_type_id ?? existing?.job_type_id,
      pipelineStage: parsed.data.status ?? existing.status,
      incomingCustomFields: extractCustomFieldValues(body),
    });

    if (!validation.valid) {
      const messages = [
        validation.missingFields.length ? `required fields: ${validation.missingFields.join(", ")}` : null,
        validation.missingDocuments.length ? `required documents: ${validation.missingDocuments.join(", ")}` : null,
      ].filter(Boolean);
      return jsonError(`Cannot move lead forward. Missing ${messages.join(" and ")}.`);
    }
  }

  const { data, error } = await supabase.schema("crm").from("leads").update(parsed.data).eq("id", id).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  await upsertCustomFieldValues({
    entityType: "lead",
    entityId: id,
    values: extractCustomFieldValues(body),
  });

  // Fire-and-forget: keep the platform-api's voice-agent snapshot in sync with
  // the latest CRM edit. Errors never block the operator — the outbox on the
  // platform-api side will re-hydrate on the next booking event anyway.
  void (async () => {
    try {
      const serviceRole = createCrmServiceRoleClient();
      await publishLeadUpdateToPlatform(serviceRole, auth.session.tenant.id, {
        lead_id: id,
        status: parsed.data.status ?? null,
        source: parsed.data.source ?? null,
        notes: parsed.data.notes ?? null,
        problem_description: parsed.data.problem_description ?? null,
        urgency_level: parsed.data.urgency_level ?? null,
        preferred_date_text: parsed.data.preferred_date_text ?? null,
        preferred_time_window: parsed.data.preferred_time_window ?? null,
        affected_area: parsed.data.affected_area ?? null,
      });
    } catch {
      // Intentionally swallow — see note above.
    }
  })();

  return jsonSuccess({ lead: data });
}
