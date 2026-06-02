import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tenant, TenantSettings, TradeVertical } from "@/modules/crm/types";

export type AiCatalogChannel = "whatsapp" | "sms" | "web_chat" | "voice";

export type AiCatalogServiceItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  active: boolean;
  bookable: boolean;
  price_enabled: boolean;
  requires_office_quote: boolean;
  estimated_duration_minutes: number | null;
  price_disclaimer: string;
  job_types: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    estimated_duration_minutes: number | null;
    bookable: boolean;
  }>;
};

export type AiCatalogPackageItem = {
  id: string;
  service_id: string | null;
  job_type_id: string | null;
  service_slug: string | null;
  service_name: string | null;
  job_type_slug: string | null;
  job_type_name: string | null;
  name: string;
  description: string | null;
  display_price: number | null;
  vat_category: string | null;
  pricing_style: "from" | "fixed";
  price_disclaimer: string;
  bookable: boolean;
  price_enabled: boolean;
  requires_office_quote: boolean;
  estimated_duration_minutes: number | null;
};

export type AiCatalogResponse = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    trade_vertical: TradeVertical;
    timezone: "Europe/London";
    currency: "GBP";
    vat_mode: "exclusive";
  };
  version: string;
  generated_at: string;
  channels: Record<AiCatalogChannel, { uses_catalog: true }>;
  services: AiCatalogServiceItem[];
  packages: AiCatalogPackageItem[];
  booking_rules: {
    default_duration_minutes: number;
    emergency_duration_minutes: number;
    can_quote_prices_in_chat: boolean;
    requires_office_quote_for_installations: boolean;
    survey_first_for_installations_and_powerflush: boolean;
  };
  pricing_policy: {
    can_give_fixed_prices: boolean;
    can_give_from_prices: boolean;
    fallback_phrase: string;
  };
  safety_policy: {
    emergency_escalation_text: string;
    gas_safety_text: string | null;
    electrical_safety_text: string | null;
  };
};

type CatalogSettings = Partial<TenantSettings> & {
  trade_vertical?: string | null;
  ai_catalog_default_duration_minutes?: number | string | null;
  ai_catalog_emergency_duration_minutes?: number | string | null;
  ai_catalog_can_give_fixed_prices?: boolean | null;
  ai_catalog_can_give_from_prices?: boolean | null;
  ai_catalog_requires_office_quote_for_installations?: boolean | null;
  ai_catalog_price_disclaimer?: string | null;
  ai_catalog_emergency_escalation_text?: string | null;
  ai_catalog_gas_safety_text?: string | null;
  ai_catalog_electrical_safety_text?: string | null;
  updated_at?: string | null;
};

type ServiceRow = {
  id: string;
  tenant_id?: string | null;
  slug: string;
  name: string;
  active?: boolean | null;
  description?: string | null;
  launch_date?: string | null;
  ai_visible?: boolean | null;
  ai_bookable?: boolean | null;
  ai_price_enabled?: boolean | null;
  ai_requires_office_quote?: boolean | null;
  ai_default_duration_minutes?: number | string | null;
  ai_price_disclaimer?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type JobTypeRow = {
  id: string;
  tenant_id?: string | null;
  service_id: string;
  slug: string;
  name: string;
  description?: string | null;
  active?: boolean | null;
  ai_visible?: boolean | null;
  ai_bookable?: boolean | null;
  ai_default_duration_minutes?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PackageItemRow = {
  id: string;
  qty?: number | string | null;
  unit_price?: number | string | null;
  sort_order?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type PackageRow = {
  id: string;
  tenant_id?: string | null;
  service_id?: string | null;
  job_type_id?: string | null;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
  ai_visible?: boolean | null;
  ai_bookable?: boolean | null;
  ai_price_enabled?: boolean | null;
  ai_requires_office_quote?: boolean | null;
  ai_default_duration_minutes?: number | string | null;
  ai_price_disclaimer?: string | null;
  ai_pricing_style?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items?: PackageItemRow[] | null;
};

export type AiCatalogProjectionInput = {
  tenant: Pick<Tenant, "id" | "slug" | "name">;
  settings?: CatalogSettings | null;
  services?: ServiceRow[];
  jobTypes?: JobTypeRow[];
  packages?: PackageRow[];
  productUpdatedAts?: Array<string | null | undefined>;
  generatedAt?: string;
};

export const aiCatalogTradeVerticals = [
  "plumbing",
  "heating",
  "electrical",
  "drainage",
  "roofing",
  "cleaning",
  "pest_control",
  "locksmith",
  "general_trades",
] as const satisfies readonly TradeVertical[];

function asTradeVertical(value: unknown): TradeVertical {
  return aiCatalogTradeVerticals.includes(value as TradeVertical) ? (value as TradeVertical) : "general_trades";
}

function asBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asPositiveInt(value: unknown, fallback: number | null = null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : fallback;
}

function asMoney(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sanitizeAiCatalogText(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;

  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "[redacted postcode]")
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 10 ? "[redacted phone]" : match;
    });
}

function defaultSafetyPolicy(vertical: TradeVertical) {
  return {
    emergency_escalation_text:
      "If there is an immediate risk to safety or property, call the emergency services or make the situation safe before waiting for a callback.",
    gas_safety_text:
      vertical === "plumbing" || vertical === "heating"
        ? "If you smell gas or suspect carbon monoxide, turn off the appliance if safe, ventilate the property, leave the area, and call the gas emergency line."
        : null,
    electrical_safety_text:
      vertical === "electrical"
        ? "If there is smoke, burning, exposed wiring, or immediate electrical danger, isolate the supply if safe and call emergency services."
        : null,
  };
}

function fallbackPhrase(settings: CatalogSettings | null | undefined) {
  const fallback = "I can give guide pricing where available, but the office confirms final pricing before work starts.";
  return sanitizeAiCatalogText(settings?.ai_catalog_price_disclaimer || fallback) || fallback;
}

function collectVersionParts(input: AiCatalogProjectionInput, catalogWithoutVersion: Omit<AiCatalogResponse, "version">) {
  const stableCatalog = { ...catalogWithoutVersion, generated_at: null };
  const rowDates = [
    input.settings?.updated_at,
    ...(input.services ?? []).flatMap((row) => [row.updated_at, row.created_at]),
    ...(input.jobTypes ?? []).flatMap((row) => [row.updated_at, row.created_at]),
    ...(input.packages ?? []).flatMap((row) => [
      row.updated_at,
      row.created_at,
      ...(row.items ?? []).flatMap((item) => [item.updated_at, item.created_at]),
    ]),
    ...(input.productUpdatedAts ?? []),
  ];
  return {
    tenant_id: input.tenant.id,
    row_dates: rowDates.filter(Boolean).sort(),
    catalog: stableCatalog,
  };
}

export function projectAiCatalog(input: AiCatalogProjectionInput): AiCatalogResponse {
  const settings = input.settings ?? null;
  const vertical = asTradeVertical(settings?.trade_vertical);
  const safetyDefaults = defaultSafetyPolicy(vertical);
  const priceFallback = fallbackPhrase(settings);
  const defaultDuration = asPositiveInt(settings?.ai_catalog_default_duration_minutes, 60) ?? 60;
  const emergencyDuration = asPositiveInt(settings?.ai_catalog_emergency_duration_minutes, 120) ?? 120;
  const services = (input.services ?? [])
    .filter((service) => service.active !== false)
    .filter((service) => service.ai_visible !== false)
    .map((service) => {
      const serviceDuration = asPositiveInt(service.ai_default_duration_minutes);
      return {
        id: service.id,
        slug: service.slug,
        name: service.name,
        description: sanitizeAiCatalogText(service.description),
        active: service.active !== false,
        bookable: service.ai_bookable !== false,
        price_enabled: service.ai_price_enabled === true,
        requires_office_quote: service.ai_requires_office_quote !== false,
        estimated_duration_minutes: serviceDuration,
        price_disclaimer: sanitizeAiCatalogText(service.ai_price_disclaimer) || priceFallback,
        job_types: (input.jobTypes ?? [])
          .filter((jobType) => jobType.service_id === service.id)
          .filter((jobType) => jobType.active !== false)
          .filter((jobType) => jobType.ai_visible !== false)
          .map((jobType) => ({
            id: jobType.id,
            slug: jobType.slug,
            name: jobType.name,
            description: sanitizeAiCatalogText(jobType.description),
            estimated_duration_minutes: asPositiveInt(jobType.ai_default_duration_minutes),
            bookable: jobType.ai_bookable !== false,
          })),
      };
    });

  const packages = (input.packages ?? [])
    .filter((pkg) => pkg.is_active !== false)
    .filter((pkg) => pkg.ai_visible !== false)
    .filter((pkg) => !pkg.service_id || services.some((service) => service.id === pkg.service_id))
    .filter(
      (pkg) =>
        !pkg.job_type_id ||
        (input.jobTypes ?? []).some(
          (jobType) =>
            jobType.id === pkg.job_type_id &&
            jobType.active !== false &&
            jobType.ai_visible !== false &&
            (!pkg.service_id || jobType.service_id === pkg.service_id),
        ),
    )
    .map((pkg) => {
      const linkedService = services.find((service) => service.id === pkg.service_id) ?? null;
      const linkedJobType =
        (input.jobTypes ?? [])
          .filter((jobType) => jobType.active !== false)
          .filter((jobType) => jobType.ai_visible !== false)
          .find((jobType) => jobType.id === pkg.job_type_id && (!pkg.service_id || jobType.service_id === pkg.service_id)) ?? null;
      const total = (pkg.items ?? []).reduce(
        (sum, item) => sum + asMoney(item.qty ?? 1) * asMoney(item.unit_price),
        0,
      );
      const priceEnabled = pkg.ai_price_enabled === true;
      const requestedStyle = pkg.ai_pricing_style === "fixed" ? "fixed" : "from";
      const pricingStyle: "from" | "fixed" =
        requestedStyle === "fixed" && pkg.ai_requires_office_quote === false && asBool(settings?.ai_catalog_can_give_fixed_prices, false)
          ? "fixed"
          : "from";
      return {
        id: pkg.id,
        service_id: pkg.service_id ?? null,
        job_type_id: linkedJobType?.id ?? null,
        service_slug: linkedService?.slug ?? null,
        service_name: linkedService?.name ?? null,
        job_type_slug: linkedJobType?.slug ?? null,
        job_type_name: linkedJobType?.name ?? null,
        name: pkg.name,
        description: sanitizeAiCatalogText(pkg.description),
        display_price: priceEnabled ? round2(total) : null,
        vat_category: null,
        pricing_style: pricingStyle,
        price_disclaimer: sanitizeAiCatalogText(pkg.ai_price_disclaimer) || priceFallback,
        bookable: pkg.ai_bookable === true,
        price_enabled: priceEnabled,
        requires_office_quote: pkg.ai_requires_office_quote !== false,
        estimated_duration_minutes: asPositiveInt(pkg.ai_default_duration_minutes),
      };
    });

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const withoutVersion: Omit<AiCatalogResponse, "version"> = {
    tenant: {
      id: input.tenant.id,
      slug: input.tenant.slug,
      name: input.tenant.name,
      trade_vertical: vertical,
      timezone: "Europe/London",
      currency: "GBP",
      vat_mode: "exclusive",
    },
    generated_at: generatedAt,
    channels: {
      whatsapp: { uses_catalog: true },
      sms: { uses_catalog: true },
      web_chat: { uses_catalog: true },
      voice: { uses_catalog: true },
    },
    services,
    packages,
    booking_rules: {
      default_duration_minutes: defaultDuration,
      emergency_duration_minutes: emergencyDuration,
      can_quote_prices_in_chat:
        asBool(settings?.ai_catalog_can_give_fixed_prices, false) ||
        asBool(settings?.ai_catalog_can_give_from_prices, true),
      requires_office_quote_for_installations: asBool(
        settings?.ai_catalog_requires_office_quote_for_installations,
        true,
      ),
      survey_first_for_installations_and_powerflush: true,
    },
    pricing_policy: {
      can_give_fixed_prices: asBool(settings?.ai_catalog_can_give_fixed_prices, false),
      can_give_from_prices: asBool(settings?.ai_catalog_can_give_from_prices, true),
      fallback_phrase: priceFallback,
    },
    safety_policy: {
      emergency_escalation_text:
        sanitizeAiCatalogText(settings?.ai_catalog_emergency_escalation_text) ||
        safetyDefaults.emergency_escalation_text,
      gas_safety_text: sanitizeAiCatalogText(settings?.ai_catalog_gas_safety_text) || safetyDefaults.gas_safety_text,
      electrical_safety_text:
        sanitizeAiCatalogText(settings?.ai_catalog_electrical_safety_text) ||
        safetyDefaults.electrical_safety_text,
    },
  };

  const version = createHash("sha256")
    .update(JSON.stringify(collectVersionParts(input, withoutVersion)))
    .digest("hex")
    .slice(0, 16);

  return { ...withoutVersion, version };
}

export function assertAiCatalogIsRedacted(catalog: AiCatalogResponse) {
  const json = JSON.stringify(catalog).toLowerCase();
  const forbiddenTerms = ["unit_cost", "markup", "margin", "profit", "supplier"];
  const piiPatterns = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i,
    /(?:\+44|0\d{2,4})[\d\s().-]{7,}\d/,
  ];
  return [
    ...forbiddenTerms.filter((term) => json.includes(term)),
    ...piiPatterns.flatMap((pattern) => (pattern.test(JSON.stringify(catalog)) ? [String(pattern)] : [])),
  ];
}

export async function buildAiCatalogForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  generatedAt?: string,
): Promise<AiCatalogResponse | null> {
  const [
    tenantResult,
    settingsResult,
    servicesResult,
    jobTypesResult,
    packagesResult,
    productsResult,
  ] = await Promise.all([
    supabase.schema("crm").from("tenants").select("*").eq("id", tenantId).maybeSingle<Tenant>(),
    supabase.schema("crm").from("tenant_settings").select("*").eq("tenant_id", tenantId).maybeSingle<CatalogSettings>(),
    supabase.schema("crm").from("services").select("*").eq("tenant_id", tenantId).order("name", { ascending: true }),
    supabase.schema("crm").from("job_types").select("*").eq("tenant_id", tenantId).order("name", { ascending: true }),
    supabase
      .schema("crm")
      .from("packages")
      .select("*, items:package_items(*)")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true }),
    supabase.schema("crm").from("products").select("updated_at").eq("tenant_id", tenantId),
  ]);

  if (tenantResult.error) {
    throw tenantResult.error;
  }
  if (!tenantResult.data) {
    return null;
  }
  for (const result of [settingsResult, servicesResult, jobTypesResult, packagesResult, productsResult]) {
    if (result.error) {
      throw result.error;
    }
  }

  return projectAiCatalog({
    tenant: tenantResult.data,
    settings: settingsResult.data ?? null,
    services: (servicesResult.data ?? []) as ServiceRow[],
    jobTypes: (jobTypesResult.data ?? []) as JobTypeRow[],
    packages: (packagesResult.data ?? []) as PackageRow[],
    productUpdatedAts: ((productsResult.data ?? []) as Array<{ updated_at?: string | null }>).map((row) => row.updated_at),
    generatedAt,
  });
}
