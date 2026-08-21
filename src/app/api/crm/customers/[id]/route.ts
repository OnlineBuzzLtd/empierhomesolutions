import { customerPatchSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { enqueueCrmPlatformEvent, publishPendingPlatformOutboxEvents } from "@/modules/platform/lib/outbox";

function deriveFullName(input: { full_name?: string | null; first_name?: string | null; last_name?: string | null }) {
  const explicit = String(input.full_name ?? "").trim();
  if (explicit.length > 0) {
    return explicit;
  }

  return [String(input.first_name ?? "").trim(), String(input.last_name ?? "").trim()].filter(Boolean).join(" ");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid customer payload.");
  }
  const parsed = customerPatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid customer payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase } = auth.session;
  const updatePayload = {
    ...parsed.data,
    ...(parsed.data.full_name !== undefined || parsed.data.first_name !== undefined || parsed.data.last_name !== undefined
      ? { full_name: deriveFullName(parsed.data) }
      : {}),
  };
  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    return jsonError(error.message, 500);
  }
  // `.single()` used to raise PGRST116 ("Cannot coerce the result to a single
  // JSON object") whenever the update matched no row — a stale tab, a deleted
  // customer, or a row RLS hides from this tenant. That surfaced to the operator
  // as another opaque 500. Missing is a 404, not a server fault.
  if (!data) {
    return jsonError("Customer not found.", 404);
  }

  await upsertCustomFieldValues({
    entityType: "customer",
    entityId: id,
    values: extractCustomFieldValues(body),
  });

  const occurredAt = String(data.updated_at ?? new Date().toISOString());
  const tenantId = String(auth.session.tenant?.id ?? data.tenant_id ?? "");
  await enqueueCrmPlatformEvent(supabase, {
    tenantId,
    eventType: "CustomerUpdated",
    aggregateType: "customer",
    aggregateId: data.id,
    idempotencyKey: `customer:${data.id}:updated:${occurredAt}`,
    occurredAt,
    payload: {
      customer_id: data.id,
      full_name: data.full_name,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      email: data.email,
      address_line1: data.address_line1,
      city: data.city,
      postcode: data.postcode,
      archived: data.archived,
      source: data.source,
    },
  });
  await publishPendingPlatformOutboxEvents(supabase);

  return jsonSuccess({ customer: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireCrmApiUser(["management", "admin"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .update({ archived: true })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  const occurredAt = String(data.updated_at ?? new Date().toISOString());
  const tenantId = String(auth.session.tenant?.id ?? data.tenant_id ?? "");
  await enqueueCrmPlatformEvent(supabase, {
    tenantId,
    eventType: "CustomerUpdated",
    aggregateType: "customer",
    aggregateId: data.id,
    idempotencyKey: `customer:${data.id}:updated:${occurredAt}`,
    occurredAt,
    payload: {
      customer_id: data.id,
      full_name: data.full_name,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      email: data.email,
      address_line1: data.address_line1,
      city: data.city,
      postcode: data.postcode,
      archived: data.archived,
      source: data.source,
    },
  });
  await publishPendingPlatformOutboxEvents(supabase);

  return jsonSuccess({ customer: data });
}
