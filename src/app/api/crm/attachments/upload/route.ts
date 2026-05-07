export const runtime = "nodejs";

import { createHash, randomBytes } from "node:crypto";
import { extname } from "node:path";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { jsonError, jsonSuccess, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";
import { normalizeAttachmentType } from "@/modules/crm/lib/attachments";
import { getCrmEnv } from "@/modules/crm/lib/env";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MiB

const ALLOWED_MIME_TYPES = new Set<string>([
  // Images
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  // PDFs
  "application/pdf",
  // Office documents
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Plain text + CSV + JSON for engineer notes
  "text/plain",
  "text/csv",
  "application/json",
]);

/** Allowed file extensions, used as a secondary check when the browser-supplied
 * MIME type is missing or generic (`application/octet-stream`). */
const ALLOWED_EXTENSIONS = new Set<string>([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".json",
]);

function sanitizeExtension(name: string): string {
  const ext = extname(name || "").toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : "";
}

function hashFileName(originalName: string): string {
  const rand = randomBytes(12).toString("hex");
  const ext = sanitizeExtension(originalName);
  const digest = createHash("sha256").update(originalName).digest("hex").slice(0, 8);
  return `${Date.now()}-${digest}-${rand}${ext}`;
}

export async function POST(request: Request) {
  if (!getCrmEnv().adminEnabled) {
    return jsonError("Supabase service role is required for file uploads.", 500);
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  // Content-Length precheck to bail out before buffering a massive body.
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES + 64 * 1024) {
      return jsonError(`File exceeds the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB upload limit.`, 413);
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid multipart form data.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Missing upload file.");
  }

  if (file.size > MAX_FILE_BYTES) {
    return jsonError(`File exceeds the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB upload limit.`, 413);
  }
  if (file.size === 0) {
    return jsonError("Uploaded file is empty.");
  }

  const reportedMime = (file.type || "").toLowerCase();
  const ext = sanitizeExtension(file.name);
  const mimeAllowed = ALLOWED_MIME_TYPES.has(reportedMime);
  const extAllowed = Boolean(ext);
  if (!mimeAllowed && !extAllowed) {
    return jsonError("File type is not permitted.", 415);
  }

  const entityType = String(formData.get("entity_type") ?? "");
  const entityId = String(formData.get("entity_id") ?? "");
  const fileType = normalizeAttachmentType(String(formData.get("file_type") ?? reportedMime ?? "file")) || "file";

  if (!entityType || !entityId) {
    return jsonError("Missing entity information.");
  }

  const { supabase, user, tenant } = auth.session;
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeFileName = hashFileName(file.name);
  const storagePath = `${tenant.id}/${entityType}/${entityId}/${safeFileName}`;
  const admin = createCrmServiceRoleClient();
  const upload = await admin.storage.from("crm-uploads").upload(storagePath, buffer, {
    contentType: reportedMime || "application/octet-stream",
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
      file_url: storagePath,
      file_type: fileType,
      created_by: resolveCreatedByUserId(user),
    })
    .select("*")
    .single();

  if (error) {
    // Best-effort cleanup: remove the just-uploaded object so we don't orphan
    // bytes in the bucket when the metadata insert fails.
    await admin.storage.from("crm-uploads").remove([storagePath]).catch(() => null);
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ attachment: data });
}
