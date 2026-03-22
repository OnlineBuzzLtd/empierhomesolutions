import { jobTypeSchema, serviceSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const body = await request.json();
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase } = auth.session;

  if (body.kind === "job_type") {
    const parsed = jobTypeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid job type payload.");
    }

    const { data, error } = await supabase.schema("crm").from("job_types").upsert(parsed.data).select("*").single();
    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ jobType: data });
  }

  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid service payload.");
  }

  const { data, error } = await supabase.schema("crm").from("services").upsert(parsed.data).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ service: data });
}
