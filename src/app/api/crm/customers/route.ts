import { customerSchema } from "@/modules/crm/lib/validation";
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

function parseCheckboxFlag(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid customer payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const customerPayload = {
    ...parsed.data,
    full_name: deriveFullName(parsed.data),
  };
  const { data, error } = await supabase.schema("crm").from("customers").insert(customerPayload).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  const siteLabel = String(body.site_label ?? "").trim();
  const siteAddressLine1 = String(body.site_address_line1 ?? "").trim();
  const siteAddressLine2 = String(body.site_address_line2 ?? "").trim();
  const siteCity = String(body.site_city ?? "").trim();
  const sitePostcode = String(body.site_postcode ?? "").trim();
  const siteAccessNotes = String(body.site_access_notes ?? "").trim();
  const siteParkingNotes = String(body.site_parking_notes ?? "").trim();
  const siteVulnerableOccupantFlag = parseCheckboxFlag(body.site_vulnerable_occupant_flag);
  const siteContactFullName = String(body.site_contact_full_name ?? "").trim();
  const siteContactPhone = String(body.site_contact_phone ?? "").trim();
  const siteContactEmail = String(body.site_contact_email ?? "").trim();
  const siteContactRole = String(body.site_contact_role ?? "").trim();

  if (siteLabel || siteAddressLine1 || sitePostcode || siteContactFullName) {
    const { data: site, error: siteError } = await supabase
      .schema("crm")
      .from("sites")
      .insert({
        tenant_id: tenant.id,
        customer_id: data.id,
        label: siteLabel || `${customerPayload.full_name} Primary Site`,
        address_line1: siteAddressLine1 || parsed.data.address_line1 || null,
        address_line2: siteAddressLine2 || parsed.data.address_line2 || null,
        city: siteCity || parsed.data.city || null,
        postcode: sitePostcode || parsed.data.postcode || null,
        access_notes: siteAccessNotes || null,
        parking_notes: siteParkingNotes || null,
        vulnerable_occupant_flag: siteVulnerableOccupantFlag,
        is_primary: true,
      })
      .select("*")
      .single();

    if (siteError) {
      return jsonError(siteError.message, 500);
    }

    if (site && siteContactFullName) {
      const { error: siteContactError } = await supabase.schema("crm").from("site_contacts").insert({
        tenant_id: tenant.id,
        site_id: site.id,
        full_name: siteContactFullName,
        phone: siteContactPhone || parsed.data.phone || null,
        email: siteContactEmail || parsed.data.email || null,
        role_label: siteContactRole || "Site contact",
        is_primary: true,
      });

      if (siteContactError) {
        return jsonError(siteContactError.message, 500);
      }
    }
  }

  const customFieldValues = extractCustomFieldValues(body);
  await upsertCustomFieldValues({
    entityType: "customer",
    entityId: data.id,
    values: customFieldValues,
  });

  const occurredAt = String(data.updated_at ?? data.created_at ?? new Date().toISOString());
  const tenantId = String(tenant.id ?? data.tenant_id ?? "");
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
