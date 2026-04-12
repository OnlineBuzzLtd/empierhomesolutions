import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { enqueueCrmPlatformEvent, publishPendingPlatformOutboxEvents } from "@/modules/platform/lib/outbox";

const tenantSettingsSchema = z.object({
  business_name: z.string().min(2),
  crm_display_name: z.string().optional().nullable(),
  primary_phone: z.string().optional().nullable(),
  support_email: z.string().email().optional().or(z.literal("")).nullable(),
  website_url: z.string().url().optional().or(z.literal("")).nullable(),
  logo_url: z.string().url().optional().or(z.literal("")).nullable(),
  accent_color: z.string().optional().nullable(),
  legal_name: z.string().optional().nullable(),
  vat_registration_number: z.string().optional().nullable(),
  gas_safe_number: z.string().optional().nullable(),
  invoice_footer: z.string().optional().nullable(),
  quote_footer: z.string().optional().nullable(),
  certificate_footer: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireManagerCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const parsed = tenantSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid workspace settings payload.");
    }

    const { supabase, tenant } = auth.session;
    const brandingPayload = {
      tenant_id: tenant.id,
      business_name: parsed.data.business_name,
      crm_display_name: parsed.data.crm_display_name || null,
      primary_phone: parsed.data.primary_phone || null,
      support_email: parsed.data.support_email || null,
      website_url: parsed.data.website_url || null,
      logo_url: parsed.data.logo_url || null,
      accent_color: parsed.data.accent_color || null,
    };
    const settingsPayload = {
      tenant_id: tenant.id,
      legal_name: parsed.data.legal_name || null,
      vat_registration_number: parsed.data.vat_registration_number || null,
      gas_safe_number: parsed.data.gas_safe_number || null,
      invoice_footer: parsed.data.invoice_footer || null,
      quote_footer: parsed.data.quote_footer || null,
      certificate_footer: parsed.data.certificate_footer || null,
    };

    const [{ data: branding, error: brandingError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.schema("crm").from("tenant_branding").upsert(brandingPayload, { onConflict: "tenant_id" }).select("*").single(),
      supabase.schema("crm").from("tenant_settings").upsert(settingsPayload, { onConflict: "tenant_id" }).select("*").single(),
    ]);

    if (brandingError || settingsError) {
      return jsonError(brandingError?.message ?? settingsError?.message ?? "Failed to save workspace settings.", 500);
    }

    const occurredAt = String(settings.updated_at ?? branding.updated_at ?? new Date().toISOString());
    await enqueueCrmPlatformEvent(supabase, {
      tenantId: tenant.id,
      eventType: "WorkspaceSettingsChanged",
      aggregateType: "workspace",
      aggregateId: tenant.id,
      idempotencyKey: `workspace:${tenant.id}:settings:${occurredAt}`,
      occurredAt,
      payload: {
        tenant_id: tenant.id,
        branding,
        settings,
      },
    });
    await publishPendingPlatformOutboxEvents(supabase);

    return jsonSuccess({ branding, settings });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update workspace settings.", 500);
  }
}
