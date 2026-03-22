import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { isCustomFieldValuePresent } from "@/modules/crm/lib/custom-fields";
import type { SupportedEntityType } from "@/modules/crm/types";

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

type ProgressionTarget = ValidationTarget & {
  entityType: "lead" | "job";
  incomingCustomFields?: Array<{ field_definition_id: string; value_json: unknown }>;
  skipDocumentCheck?: boolean;
};

export async function validateRequiredProgression(target: ProgressionTarget) {
  const supabase = await createCrmServerClient();

  const [{ data: rules }, { data: fieldDefinitions }, { data: existingCustomValues }] = await Promise.all([
    supabase
      .schema("crm")
      .from("required_document_rules")
      .select("*")
      .eq("entity_type", target.entityType)
      .eq("active", true),
    supabase
      .schema("crm")
      .from("custom_field_definitions")
      .select("*")
      .eq("entity_type", target.entityType as SupportedEntityType)
      .eq("active", true)
      .eq("required", true),
    target.entityId
      ? supabase
          .schema("crm")
          .from("custom_field_values")
          .select("field_definition_id, value_json")
          .eq("entity_type", target.entityType)
          .eq("entity_id", target.entityId)
      : Promise.resolve({ data: [] }),
  ]);

  const matchingRules = (rules ?? []).filter((rule) => {
    const matchesService = !rule.service_id || rule.service_id === target.serviceId;
    const matchesJobType = !rule.job_type_id || rule.job_type_id === target.jobTypeId;
    const matchesStage = !rule.pipeline_stage || rule.pipeline_stage === target.pipelineStage;
    return matchesService && matchesJobType && matchesStage && rule.required;
  });

  const matchingFields = (fieldDefinitions ?? []).filter((field) => {
    const matchesService = !field.service_id || field.service_id === target.serviceId;
    const matchesJobType = !field.job_type_id || field.job_type_id === target.jobTypeId;
    return matchesService && matchesJobType;
  });

  const mergedFieldValues = new Map<string, unknown>();
  for (const value of existingCustomValues ?? []) {
    mergedFieldValues.set(value.field_definition_id, value.value_json);
  }
  for (const value of target.incomingCustomFields ?? []) {
    mergedFieldValues.set(value.field_definition_id, value.value_json);
  }

  const missingFields = matchingFields
    .filter((field) => !isCustomFieldValuePresent(mergedFieldValues.get(field.id)))
    .map((field) => field.label);

  let missingDocuments: string[] = [];
  if (!target.skipDocumentCheck && matchingRules.length > 0) {
    const { data: attachments } = await supabase
      .schema("crm")
      .from("attachments")
      .select("file_type")
      .eq("entity_type", target.entityType)
      .eq("entity_id", target.entityId);

    const availableTypes = new Set((attachments ?? []).map((attachment) => attachment.file_type));
    missingDocuments = matchingRules
      .map((rule) => rule.document_type)
      .filter((documentType) => !availableTypes.has(documentType));
  }

  return {
    valid: missingFields.length === 0 && missingDocuments.length === 0,
    missingFields,
    missingDocuments,
  };
}
