import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { getPlatformEventById } from "@/modules/platform/lib/repository";
import { processPlatformEvent } from "@/modules/platform/lib/processor";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  if (!UUID_RE.test(eventId)) {
    return jsonError("Invalid event id.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const event = await getPlatformEventById(supabase, tenant.id, eventId);
  if (!event) {
    return jsonError("Platform event not found.", 404);
  }
  if (event.processing_status === "dead_letter") {
    return jsonError("Dead-lettered platform events cannot be replayed.", 409);
  }
  if (event.processing_status !== "failed") {
    return jsonError("Only failed platform events can be replayed.", 409);
  }

  const result = await processPlatformEvent(supabase, event.envelope);
  return jsonSuccess({ result });
}
