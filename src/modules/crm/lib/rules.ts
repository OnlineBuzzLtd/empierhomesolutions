import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

type ValidationTarget = {
  entityType: "lead" | "job" | "asset";
  entityId: string;
  serviceId?: string | null;
  jobTypeId?: string | null;
  pipelineStage?: string | null;
};

export async function validateRequiredDocuments(target: ValidationTarget) {
  const supabase = await createCrmServerClient();
  const { data: rules } = await supabase
    .schema("crm")
    .from("required_document_rules")
    .select("*")
    .eq("entity_type", target.entityType)
    .eq("active", true);

  const matchingRules = (rules ?? []).filter((rule) => {
    const matchesService = !rule.service_id || rule.service_id === target.serviceId;
    const matchesJobType = !rule.job_type_id || rule.job_type_id === target.jobTypeId;
    const matchesStage = !rule.pipeline_stage || rule.pipeline_stage === target.pipelineStage;
    return matchesService && matchesJobType && matchesStage && rule.required;
  });

  if (matchingRules.length === 0) {
    return { valid: true, missing: [] as string[] };
  }

  const { data: attachments } = await supabase
    .schema("crm")
    .from("attachments")
    .select("file_type")
    .eq("entity_type", target.entityType)
    .eq("entity_id", target.entityId);

  const availableTypes = new Set((attachments ?? []).map((attachment) => attachment.file_type));
  const missing = matchingRules
    .map((rule) => rule.document_type)
    .filter((documentType) => !availableTypes.has(documentType));

  return {
    valid: missing.length === 0,
    missing,
  };
}
