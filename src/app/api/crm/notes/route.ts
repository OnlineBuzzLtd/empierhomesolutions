import { noteSchema } from "@/modules/crm/lib/validation";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { jsonError, jsonSuccess, parseJsonBody } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, noteSchema);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid note payload.");
  }

  const supabase = await createCrmServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    ...parsed.data,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.schema("crm").from("notes").insert(payload).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ note: data });
}
