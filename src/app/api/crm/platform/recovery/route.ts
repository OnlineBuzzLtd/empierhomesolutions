import { jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import {
  listFailedPlatformCommands,
  listFailedPlatformEvents,
  listFailedPlatformOutboxEvents,
} from "@/modules/platform/lib/repository";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const [events, commands, outbox] = await Promise.all([
    listFailedPlatformEvents(supabase, tenant.id, 50),
    listFailedPlatformCommands(supabase, tenant.id, 50),
    listFailedPlatformOutboxEvents(supabase, tenant.id, 50),
  ]);

  return jsonSuccess({ events, commands, outbox });
}
