import { z } from "zod";
import {
  customerPromiseChannels,
  customerPromiseOrigins,
  customerPromiseStatuses,
  customerPromiseTypes,
} from "@/modules/crm/types";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { updateCustomerPromiseWithClient } from "@/modules/crm/lib/customer-promises";

const emptyStringToNull = (value: unknown) => (value === "" ? null : value);

const customerPromisePatchSchema = z.object({
  customer_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  lead_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  job_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  quote_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  invoice_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  platform_conversation_id: z.preprocess(emptyStringToNull, z.string().optional().nullable()),
  platform_event_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  promise_type: z.enum(customerPromiseTypes).optional(),
  title: z.string().min(2).optional(),
  detail: z.string().optional().nullable(),
  owner_user_id: z.preprocess(emptyStringToNull, z.string().uuid().optional().nullable()),
  due_at: z.string().optional().nullable(),
  channel: z.enum(customerPromiseChannels).optional(),
  status: z.enum(customerPromiseStatuses).optional(),
  origin: z.enum(customerPromiseOrigins).optional(),
  idempotency_key: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = customerPromisePatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid customer promise update.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const promise = await updateCustomerPromiseWithClient(auth.session.supabase, auth.session.tenant.id, id, {
      ...parsed.data,
      updated_by: auth.session.user.id,
    });
    return jsonSuccess({ promise });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not update customer promise.", 500);
  }
}
