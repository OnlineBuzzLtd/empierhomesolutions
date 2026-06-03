import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { publishPlatformOutboxEventById } from "@/modules/platform/lib/outbox";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: { params: Promise<{ outboxId: string }> },
) {
  const { outboxId } = await context.params;
  if (!UUID_RE.test(outboxId)) {
    return jsonError("Invalid outbox event id.");
  }

  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  try {
    const result = await publishPlatformOutboxEventById(supabase, {
      tenantId: tenant.id,
      id: outboxId,
    });
    return jsonSuccess({ result });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to replay outbox event.", 409);
  }
}
