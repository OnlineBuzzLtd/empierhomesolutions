import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { getPlatformOutboxEventById, markPlatformOutboxEventDeadLetter } from "@/modules/platform/lib/repository";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deadLetterSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ outboxId: string }> },
) {
  const { outboxId } = await context.params;
  if (!UUID_RE.test(outboxId)) {
    return jsonError("Invalid outbox event id.");
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
  const event = await getPlatformOutboxEventById(supabase, tenant.id, outboxId);
  if (!event) {
    return jsonError("Platform outbox event not found.", 404);
  }
  if (event.publication_status !== "failed") {
    return jsonError("Only failed platform outbox events can be dead-lettered.", 409);
  }

  await markPlatformOutboxEventDeadLetter(supabase, {
    id: outboxId,
    tenantId: tenant.id,
    reason: parsed.data.reason,
  });
  return jsonSuccess();
}
