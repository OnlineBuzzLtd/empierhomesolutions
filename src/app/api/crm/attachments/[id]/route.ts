export const runtime = "nodejs";

import { createCrmServerClient, createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { jsonError, jsonSuccess } from "@/modules/crm/lib/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getCrmEnv().adminEnabled) {
    return jsonError("Supabase service role is required for file deletion.", 500);
  }

  const { id } = await params;
  const supabase = await createCrmServerClient();
  const { data: attachment, error: fetchError } = await supabase.schema("crm").from("attachments").select("*").eq("id", id).single();
  if (fetchError || !attachment) {
    return jsonError(fetchError?.message ?? "Attachment not found.", 404);
  }

  const admin = createCrmServiceRoleClient();
  const storageResult = await admin.storage.from("crm-uploads").remove([attachment.file_url]);
  if (storageResult.error) {
    return jsonError(storageResult.error.message, 500);
  }

  const { error } = await supabase.schema("crm").from("attachments").delete().eq("id", id);
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess();
}
