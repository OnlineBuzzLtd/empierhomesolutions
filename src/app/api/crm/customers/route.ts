import { customerSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

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
  const { data, error } = await supabase.schema("crm").from("customers").insert(parsed.data).select("*").single();
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
        label: siteLabel || `${parsed.data.full_name} Primary Site`,
        address_line1: siteAddressLine1 || parsed.data.address_line1 || null,
        address_line2: siteAddressLine2 || parsed.data.address_line2 || null,
        city: siteCity || parsed.data.city || null,
        postcode: sitePostcode || parsed.data.postcode || null,
        access_notes: siteAccessNotes || null,
        parking_notes: siteParkingNotes || null,
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

  return jsonSuccess({ customer: data });
}
