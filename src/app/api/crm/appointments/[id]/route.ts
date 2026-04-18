import { appointmentSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = appointmentSchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid appointment payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase.schema("crm").from("appointments").update(parsed.data).eq("id", id).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  // Keep the linked job's engineer in sync with the appointment. The diary view
  // filters jobs by the logged-in engineer's full name against
  // `jobs.assigned_engineer` (a display-name string), while `appointments.assigned_to`
  // is a user_profiles UUID. Without this sync, allocating via the diary never
  // surfaces the job for that engineer.
  const assignedToValue = (parsed.data as { assigned_to?: string | null | undefined }).assigned_to;
  const assignedToTouched = Object.prototype.hasOwnProperty.call(parsed.data, "assigned_to");
  const linkedJobId = data?.job_id ?? null;
  if (assignedToTouched && linkedJobId) {
    let engineerName: string | null = null;
    if (assignedToValue) {
      const { data: profile } = await supabase
        .schema("crm")
        .from("user_profiles")
        .select("full_name")
        .eq("id", assignedToValue)
        .maybeSingle<{ full_name: string | null }>();
      engineerName = profile?.full_name?.trim() || null;
    }

    await supabase.schema("crm").from("job_assignees").delete().eq("job_id", linkedJobId);
    if (assignedToValue) {
      await supabase.schema("crm").from("job_assignees").insert({
        tenant_id: tenant.id,
        job_id: linkedJobId,
        user_profile_id: assignedToValue,
      });
    }

    await supabase
      .schema("crm")
      .from("jobs")
      .update({ assigned_engineer: engineerName })
      .eq("id", linkedJobId)
      .eq("tenant_id", tenant.id);
  }

  return jsonSuccess({ appointment: data });
}
