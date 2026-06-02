import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmRole } from "@/modules/crm/types";

export const officeCommercialRoles: CrmRole[] = ["management", "admin", "sales", "accounts"];
export const fieldSurveyRoles: CrmRole[] = ["management", "admin", "sales", "engineer"];

export async function ensureTenantJob(
  supabase: SupabaseClient,
  tenantId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("jobs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to check job.");
  }

  return data !== null;
}
