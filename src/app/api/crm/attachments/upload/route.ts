export const runtime = "nodejs";

import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { jsonError, jsonSuccess, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";
import { normalizeAttachmentType } from "@/modules/crm/lib/attachments";
import { getCrmEnv } from "@/modules/crm/lib/env";

export async function POST(request: Request) {
  if (!getCrmEnv().adminEnabled) {
    return jsonError("Supabase service role is required for file uploads.", 500);
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Missing upload file.");
  }

  const entityType = String(formData.get("entity_type") ?? "");
  const entityId = String(formData.get("entity_id") ?? "");
  const fileType = normalizeAttachmentType(String(formData.get("file_type") ?? file.type ?? "file")) || "file";

  if (!entityType || !entityId) {
    return jsonError("Missing entity information.");
  }

  const { supabase, user, tenant } = auth.session;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${tenant.id}/${entityType}/${entityId}/${Date.now()}-${file.name}`;
  const admin = createCrmServiceRoleClient();
  const upload = await admin.storage.from("crm-uploads").upload(fileName, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (upload.error) {
    return jsonError(upload.error.message, 500);
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("attachments")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      file_url: fileName,
      file_type: fileType,
      created_by: resolveCreatedByUserId(user),
    })
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ attachment: data });
}
