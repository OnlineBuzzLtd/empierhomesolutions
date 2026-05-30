import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import {
  recoverBookingConfirmedEvent,
  type BookingRecoveryAction,
} from "@/modules/platform/lib/command-executor";
import {
  getPlatformEventById,
  getWorkspaceAlias,
  updatePlatformEventStatus,
} from "@/modules/platform/lib/repository";

const recoveryActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_new_customer_and_job") }),
  z.object({ action: z.literal("link_existing_customer"), customerId: z.string().uuid() }),
  z.object({ action: z.literal("link_existing_job"), jobId: z.string().uuid() }),
  z.object({ action: z.literal("dismiss") }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const parsed = await parseJsonBody(request, recoveryActionSchema);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid recovery action.");
  }

  const { id } = await context.params;
  const { supabase, tenant } = auth.session;
  const event = await getPlatformEventById(supabase, tenant.id, id);
  if (!event) {
    return jsonError("Booking recovery case was not found.", 404);
  }
  if (event.envelope.event_type !== "BookingConfirmed") {
    return jsonError("Only booking events can be resolved from this endpoint.");
  }

  if (parsed.data.action === "dismiss") {
    await updatePlatformEventStatus(
      supabase,
      event.envelope.event_id,
      tenant.id,
      "ignored",
      "Dismissed from AI Receptionist review.",
    );
    return jsonSuccess({ resolved: true });
  }

  const alias = await getWorkspaceAlias(supabase, tenant.id);
  if (!alias) {
    return jsonError("CRM workspace alias is not configured.", 500);
  }

  await recoverBookingConfirmedEvent(supabase, alias, event.envelope, parsed.data as BookingRecoveryAction);
  await updatePlatformEventStatus(supabase, event.envelope.event_id, tenant.id, "processed");
  return jsonSuccess({ resolved: true });
}
