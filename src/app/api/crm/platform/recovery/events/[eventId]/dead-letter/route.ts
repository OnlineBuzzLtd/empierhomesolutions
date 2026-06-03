import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { getPlatformEventById, markPlatformEventDeadLetter } from "@/modules/platform/lib/repository";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deadLetterSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  if (!UUID_RE.test(eventId)) {
    return jsonError("Invalid event id.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.");
  }

  const parsed = deadLetterSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Dead-letter reason is required.");
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
  if (event.processing_status !== "failed") {
    return jsonError("Only failed platform events can be dead-lettered.", 409);
  }

  await markPlatformEventDeadLetter(supabase, {
    eventId,
    tenantId: tenant.id,
    reason: parsed.data.reason,
  });
  return jsonSuccess();
}
