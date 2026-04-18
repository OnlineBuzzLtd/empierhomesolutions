import type { User } from "@supabase/supabase-js";
import type { CrmRole, Tenant, TenantBranding, TenantSettings, UserProfile } from "@/modules/crm/types";
import { ensureCustomerJourneysRuntimeLink } from "@/modules/crm/lib/customerjourneys";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { ensureTenantTwilioProvisioning } from "@/modules/crm/lib/twilio-provisioning";

type ServiceRoleClient = ReturnType<typeof createCrmServiceRoleClient>;

type IdRow = { id: string };

export type TenantWorkspaceProvisioningInput = {
  name: string;
  slug: string;
  business_name?: string | null;
  crm_display_name?: string | null;
  primary_phone?: string | null;
  support_email?: string | null;
  accent_color?: string | null;
  legal_name?: string | null;
  vat_registration_number?: string | null;
  gas_safe_number?: string | null;
  clone_from_source?: boolean;
  source_tenant_id?: string | null;
  owner: {
    user: Pick<User, "id" | "email" | "user_metadata">;
    role?: CrmRole | null;
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
    emergency_contact?: string | null;
    agreed_hours?: string | null;
    pay_type?: string | null;
    pay_notes?: string | null;
    contract_file_url?: string | null;
  };
};

export type TenantWorkspaceProvisioningResult = {
  tenant: Tenant;
  branding: TenantBranding | null;
  settings: TenantSettings | null;
  warnings: string[];
};

async function resolveSourceTenant(admin: ServiceRoleClient, requestedTenantId?: string | null) {
  if (requestedTenantId) {
    const { data } = await admin.schema("crm").from("tenants").select("*").eq("id", requestedTenantId).maybeSingle<Tenant>();
    return data ?? null;
  }

  const { data: empireTenant } = await admin
    .schema("crm")
    .from("tenants")
    .select("*")
    .eq("slug", "empire-home-solutions")
    .maybeSingle<Tenant>();

  if (empireTenant) {
    return empireTenant;
  }

  const { data: activeTenants } = await admin
    .schema("crm")
    .from("tenants")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  return ((activeTenants ?? []) as Tenant[])[0] ?? null;
}

async function cloneTenantBaseline(admin: ServiceRoleClient, sourceTenantId: string, newTenantId: string, warnings: string[]) {
  const [
    { data: services },
    { data: jobTypes },
    { data: customFields },
    { data: rules },
    { data: suppliers },
    { data: products },
    { data: templates },
    { data: addons },
  ] = await Promise.all([
    admin.schema("crm").from("services").select("*").eq("tenant_id", sourceTenantId).order("created_at"),
    admin.schema("crm").from("job_types").select("*").eq("tenant_id", sourceTenantId).order("created_at"),
    admin.schema("crm").from("custom_field_definitions").select("*").eq("tenant_id", sourceTenantId).order("created_at"),
    admin.schema("crm").from("required_document_rules").select("*").eq("tenant_id", sourceTenantId).order("created_at"),
    admin.schema("crm").from("suppliers").select("*").eq("tenant_id", sourceTenantId).order("created_at"),
    admin.schema("crm").from("products").select("*").eq("tenant_id", sourceTenantId).order("created_at"),
    admin.schema("crm").from("quote_templates").select("*").eq("tenant_id", sourceTenantId).order("created_at"),
    admin.schema("crm").from("product_addons").select("*").eq("tenant_id", sourceTenantId).order("created_at"),
  ]);

  const serviceIdMap = new Map<string, string>();
  const supplierIdMap = new Map<string, string>();
  const jobTypeIdMap = new Map<string, string>();

  for (const service of (services ?? []) as Array<Record<string, unknown>>) {
    const { data, error } = await admin
      .schema("crm")
      .from("services")
      .insert({
        tenant_id: newTenantId,
        slug: service.slug,
        name: service.name,
        active: service.active,
        launch_date: service.launch_date,
      })
      .select("id")
      .single<IdRow>();
    if (error || !data) {
      warnings.push(error?.message ?? `Failed to clone service ${String(service.slug)}`);
      continue;
    }
    serviceIdMap.set(String(service.id), data.id);
  }

  for (const supplier of (suppliers ?? []) as Array<Record<string, unknown>>) {
    const { data, error } = await admin
      .schema("crm")
      .from("suppliers")
      .insert({
        tenant_id: newTenantId,
        name: supplier.name,
        category: supplier.category,
        contact_name: supplier.contact_name,
        email: supplier.email,
        phone: supplier.phone,
        pricing_last_updated_at: supplier.pricing_last_updated_at,
        notes: supplier.notes,
      })
      .select("id")
      .single<IdRow>();
    if (error || !data) {
      warnings.push(error?.message ?? `Failed to clone supplier ${String(supplier.name)}`);
      continue;
    }
    supplierIdMap.set(String(supplier.id), data.id);
  }

  for (const jobType of (jobTypes ?? []) as Array<Record<string, unknown>>) {
    const { data, error } = await admin
      .schema("crm")
      .from("job_types")
      .insert({
        tenant_id: newTenantId,
        service_id: jobType.service_id ? serviceIdMap.get(String(jobType.service_id)) ?? null : null,
        slug: jobType.slug,
        name: jobType.name,
        description: jobType.description,
        active: jobType.active,
      })
      .select("id")
      .single<IdRow>();
    if (error || !data) {
      warnings.push(error?.message ?? `Failed to clone job type ${String(jobType.slug)}`);
      continue;
    }
    jobTypeIdMap.set(String(jobType.id), data.id);
  }

  for (const field of (customFields ?? []) as Array<Record<string, unknown>>) {
    const { error } = await admin.schema("crm").from("custom_field_definitions").insert({
      tenant_id: newTenantId,
      entity_type: field.entity_type,
      service_id: field.service_id ? serviceIdMap.get(String(field.service_id)) ?? null : null,
      job_type_id: field.job_type_id ? jobTypeIdMap.get(String(field.job_type_id)) ?? null : null,
      field_key: field.field_key,
      label: field.label,
      field_type: field.field_type,
      options: field.options,
      required: field.required,
      active: field.active,
      sort_order: field.sort_order,
    });
    if (error) {
      warnings.push(error.message);
    }
  }

  for (const rule of (rules ?? []) as Array<Record<string, unknown>>) {
    const { error } = await admin.schema("crm").from("required_document_rules").insert({
      tenant_id: newTenantId,
      entity_type: rule.entity_type,
      service_id: rule.service_id ? serviceIdMap.get(String(rule.service_id)) ?? null : null,
      job_type_id: rule.job_type_id ? jobTypeIdMap.get(String(rule.job_type_id)) ?? null : null,
      pipeline_stage: rule.pipeline_stage,
      document_type: rule.document_type,
      required: rule.required,
      due_within_days: rule.due_within_days,
      active: rule.active,
    });
    if (error) {
      warnings.push(error.message);
    }
  }

  for (const product of (products ?? []) as Array<Record<string, unknown>>) {
    const { error } = await admin.schema("crm").from("products").insert({
      tenant_id: newTenantId,
      service_id: product.service_id ? serviceIdMap.get(String(product.service_id)) ?? null : null,
      supplier_id: product.supplier_id ? supplierIdMap.get(String(product.supplier_id)) ?? null : null,
      category: product.category,
      name: product.name,
      sku: product.sku,
      unit_cost: product.unit_cost,
      markup_percent: product.markup_percent,
      sell_price: product.sell_price,
      vat_category: product.vat_category,
      active: product.active,
    });
    if (error) {
      warnings.push(error.message);
    }
  }

  for (const template of (templates ?? []) as Array<Record<string, unknown>>) {
    const { error } = await admin.schema("crm").from("quote_templates").insert({
      tenant_id: newTenantId,
      service_id: template.service_id ? serviceIdMap.get(String(template.service_id)) ?? null : null,
      job_type_id: template.job_type_id ? jobTypeIdMap.get(String(template.job_type_id)) ?? null : null,
      name: template.name,
      description: template.description,
      line_items: template.line_items,
      optional_extras: template.optional_extras,
      payment_terms: template.payment_terms,
      active: template.active,
    });
    if (error) {
      warnings.push(error.message);
    }
  }

  for (const addon of (addons ?? []) as Array<Record<string, unknown>>) {
    const { error } = await admin.schema("crm").from("product_addons").insert({
      tenant_id: newTenantId,
      addon_key: addon.addon_key,
      enabled: addon.enabled,
      demo_enabled: addon.demo_enabled,
      display_name: addon.display_name,
      price_label: addon.price_label,
      cta_url: addon.cta_url,
      summary: addon.summary,
    });
    if (error) {
      warnings.push(error.message);
    }
  }
}

export async function createTenantWorkspace(admin: ServiceRoleClient, input: TenantWorkspaceProvisioningInput): Promise<TenantWorkspaceProvisioningResult> {
  const sourceTenant = input.clone_from_source ? await resolveSourceTenant(admin, input.source_tenant_id) : null;
  const sourceBranding =
    sourceTenant
      ? (
          await admin.schema("crm").from("tenant_branding").select("*").eq("tenant_id", sourceTenant.id).maybeSingle<TenantBranding>()
        ).data ?? null
      : null;

  const nextBusinessName = input.business_name?.trim() || input.name.trim();
  const nextCrmDisplayName = input.crm_display_name?.trim() || `${input.name.trim()} CRM`;

  const { data: createdTenant, error: tenantError } = await admin
    .schema("crm")
    .from("tenants")
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim(),
      status: "active",
    })
    .select("*")
    .single<Tenant>();

  if (tenantError || !createdTenant) {
    throw new Error(tenantError?.message ?? "Failed to create tenant.");
  }

  const ownerFullName =
    input.owner.full_name?.trim() ||
    String(input.owner.user.user_metadata.full_name ?? input.owner.user.email?.split("@")[0] ?? "Workspace Owner");

  const brandingPayload = {
    tenant_id: createdTenant.id,
    business_name: nextBusinessName,
    crm_display_name: nextCrmDisplayName,
    primary_phone: input.primary_phone?.trim() || sourceBranding?.primary_phone || null,
    support_email: input.support_email?.trim() || sourceBranding?.support_email || null,
    accent_color: input.accent_color?.trim() || sourceBranding?.accent_color || null,
  };

  const settingsPayload = {
    tenant_id: createdTenant.id,
    legal_name: input.legal_name?.trim() || input.name.trim(),
    vat_registration_number: input.vat_registration_number?.trim() || null,
    gas_safe_number: input.gas_safe_number?.trim() || null,
  };

  const membershipPayload = {
    tenant_id: createdTenant.id,
    user_id: input.owner.user.id,
    role: input.owner.role ?? "admin",
    active: true,
    is_owner: true,
    is_demo: false,
  };

  const profilePayload: Omit<UserProfile, "id" | "created_at" | "updated_at"> = {
    tenant_id: createdTenant.id,
    user_id: input.owner.user.id,
    role: input.owner.role ?? "admin",
    full_name: ownerFullName,
    phone: input.owner.phone?.trim() || null,
    email: input.owner.email?.trim() || input.owner.user.email || null,
    emergency_contact: input.owner.emergency_contact?.trim() || null,
    agreed_hours: input.owner.agreed_hours?.trim() || null,
    pay_type: input.owner.pay_type?.trim() || null,
    pay_notes: input.owner.pay_notes?.trim() || null,
    contract_file_url: input.owner.contract_file_url?.trim() || null,
    active: true,
    is_demo: false,
    demo_scenario_key: null,
  };

  const warnings: string[] = [];
  const [brandingResult, settingsResult, membershipResult, profileResult] = await Promise.all([
    admin.schema("crm").from("tenant_branding").upsert(brandingPayload, { onConflict: "tenant_id" }).select("*").single<TenantBranding>(),
    admin.schema("crm").from("tenant_settings").upsert(settingsPayload, { onConflict: "tenant_id" }).select("*").single<TenantSettings>(),
    admin.schema("crm").from("tenant_memberships").upsert(membershipPayload, { onConflict: "tenant_id,user_id" }),
    admin.schema("crm").from("user_profiles").upsert(profilePayload, { onConflict: "tenant_id,user_id" }),
  ]);

  for (const result of [brandingResult, settingsResult, membershipResult, profileResult]) {
    if (result.error) {
      warnings.push(result.error.message);
    }
  }

  if (sourceTenant?.id) {
    await cloneTenantBaseline(admin, sourceTenant.id, createdTenant.id, warnings);
  }

  try {
    const runtimeLink = await ensureCustomerJourneysRuntimeLink(admin, {
      tenant: createdTenant,
      timezone: "Europe/London",
    });
    if (runtimeLink.warning) {
      warnings.push(runtimeLink.warning);
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Failed to link CustomerJourneys runtime.");
  }

  try {
    const twilio = await ensureTenantTwilioProvisioning(admin, {
      id: createdTenant.id,
      name: createdTenant.name,
      slug: createdTenant.slug,
    });
    for (const warning of twilio.warnings) {
      warnings.push(`[twilio:${warning.step}] ${warning.message}`);
    }
  } catch (error) {
    warnings.push(
      error instanceof Error ? `[twilio] ${error.message}` : "[twilio] Failed to provision Twilio resources.",
    );
  }

  return {
    tenant: createdTenant,
    branding: brandingResult.data ?? null,
    settings: settingsResult.data ?? null,
    warnings,
  };
}
