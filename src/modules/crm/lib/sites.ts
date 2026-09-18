import { jsonError } from "@/modules/crm/lib/api";

export function siteWriteError(error: { code?: string; message: string }) {
  if (error.code === "23505" || error.code === "40P01" || error.code === "40001") {
    return jsonError("Another site change conflicted with this save. Refresh and try again.", 409);
  }
  if (error.code === "23503") {
    return jsonError("This site is linked to jobs or contacts and cannot be deleted.", 409);
  }
  if (error.code === "42501") return jsonError("You do not have access to this site action.", 403);
  console.error(JSON.stringify({ event: "crm_site_write_failed", code: error.code ?? "unknown" }));
  return jsonError("Unable to save the site. Please try again.", 500);
}
