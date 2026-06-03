import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { markPlatformCommandDeadLetter } from "@/modules/platform/lib/repository";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deadLetterSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ commandId: string }> },
) {
  const { commandId } = await context.params;
  if (!UUID_RE.test(commandId)) {
    return jsonError("Invalid command id.");
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
  await markPlatformCommandDeadLetter(supabase, {
    commandId,
    tenantId: tenant.id,
    reason: parsed.data.reason,
  });
  return jsonSuccess();
}
