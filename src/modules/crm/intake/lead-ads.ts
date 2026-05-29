import type { SupabaseClient } from "@supabase/supabase-js";
import { captureInboundLead, resolveInboundTenant } from "@/modules/crm/intake/inbound";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function fieldValueFromUserColumnData(payload: Record<string, unknown>, names: string[]) {
  const columns = payload.user_column_data ?? payload.userColumnData ?? payload.field_data ?? payload.fieldData;
  if (!Array.isArray(columns)) {
    return null;
  }
  const normalizedNames = names.map((name) => name.toLowerCase());
  for (const column of columns) {
    const record = asRecord(column);
    const name = asString(record.column_name ?? record.name ?? record.field_name)?.toLowerCase();
    if (!name || !normalizedNames.includes(name)) {
      continue;
    }
    const values = record.values;
    if (Array.isArray(values)) {
      const first = values.find((value) => typeof value === "string" && value.trim().length > 0);
      if (typeof first === "string") {
        return first.trim();
      }
    }
    const value = asString(record.string_value ?? record.value);
    if (value) {
      return value;
    }
  }
  return null;
}

export function extractLeadAdContact(body: unknown) {
  const root = asRecord(body);
  const firstEntry = Array.isArray(root.entry) ? root.entry[0] : undefined;
  const payload = asRecord(root.lead ?? firstEntry ?? root);
  const changes = Array.isArray(payload.changes) ? asRecord(asRecord(payload.changes[0]).value) : {};
  const data = Object.keys(changes).length > 0 ? changes : payload;
  const nestedLead = asRecord(data.lead ?? data.leadgen ?? data.form_response);
  const record = Object.keys(nestedLead).length > 0 ? nestedLead : data;

  const fullName =
    asString(record.full_name ?? record.fullName ?? record.name) ??
    fieldValueFromUserColumnData(record, ["full_name", "name", "customer_name"]);
  const phone =
    asString(record.phone_number ?? record.phone ?? record.phoneNumber) ??
    fieldValueFromUserColumnData(record, ["phone_number", "phone", "mobile"]);
  const email =
    asString(record.email ?? record.email_address ?? record.emailAddress) ??
    fieldValueFromUserColumnData(record, ["email", "email_address"]);
  const postcode =
    asString(record.postcode ?? record.zip ?? record.postal_code) ??
    fieldValueFromUserColumnData(record, ["postcode", "postal_code", "zip"]);
  const message =
    asString(record.message ?? record.comments ?? record.service) ??
    fieldValueFromUserColumnData(record, ["message", "comments", "service", "issue"]) ??
    "Lead ads enquiry";

  return {
    fullName,
    phone,
    email,
    postcode,
    message,
    externalLeadId: asString(record.lead_id ?? record.leadgen_id ?? record.id),
    formId: asString(record.form_id ?? record.formId),
    raw: root,
  };
}

export async function handleLeadAdWebhook(
  supabase: SupabaseClient,
  input: {
    provider: "google" | "meta";
    body: unknown;
    tenantId?: string | null;
    tenantSlug?: string | null;
  },
) {
  const contact = extractLeadAdContact(input.body);
  const tenant = await resolveInboundTenant(supabase, {
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
  });
  if (!tenant) {
    throw new Error("Unable to resolve tenant for lead ad webhook.");
  }
  const captured = await captureInboundLead(supabase, {
    tenantId: tenant.tenantId,
    source: input.provider === "google" ? "google_lead_ads" : "meta_lead_ads",
    fullName: contact.fullName,
    phone: contact.phone,
    email: contact.email,
    postcode: contact.postcode,
    message: contact.message,
    metadata: {
      provider: input.provider,
      externalLeadId: contact.externalLeadId,
      formId: contact.formId,
      tenantResolution: tenant.source,
      raw: contact.raw,
    },
  });
  return {
    tenant,
    ...captured,
  };
}
