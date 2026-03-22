export const runtime = "nodejs";

import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getCrmEnv().adminEnabled) {
    return jsonError("Supabase service role is required for signed URLs.", 500);
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const { supabase } = auth.session;
  const { data: attachment, error } = await supabase.schema("crm").from("attachments").select("*").eq("id", id).single();
  if (error || !attachment) {
    return jsonError(error?.message ?? "Attachment not found.", 404);
  }

  const admin = createCrmServiceRoleClient();
  const signed = await admin.storage.from("crm-uploads").createSignedUrl(attachment.file_url, 60 * 60);
  if (signed.error) {
    return jsonError(signed.error.message, 500);
  }

  return jsonSuccess({ attachment, signedUrl: signed.data.signedUrl });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getCrmEnv().adminEnabled) {
    return jsonError("Supabase service role is required for file deletion.", 500);
  }

  const auth = await requireCrmApiUser(["management", "admin"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const { supabase } = auth.session;
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
