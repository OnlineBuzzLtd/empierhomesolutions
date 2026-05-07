import { getCrmEnv } from "@/modules/crm/lib/env";
import type { CustomerJourneysRuntimeLink } from "@/modules/crm/lib/customerjourneys";

export const calendarAdminAccessStatuses = [
  "ready",
  "missing_runtime_link",
  "missing_platform_tenant_id",
  "missing_platform_base_url",
  "missing_internal_token",
] as const;

export type CalendarAdminAccessStatus = (typeof calendarAdminAccessStatuses)[number];

type CalendarAdminAccessEnv = Pick<
  ReturnType<typeof getCrmEnv>,
  | "customerJourneysPlatformApiBaseUrl"
  | "customerJourneysPlatformApiBaseUrlOverride"
  | "customerJourneysInternalApiToken"
>;

export type CalendarAdminAccessState = {
  status: CalendarAdminAccessStatus;
  ready: boolean;
  message: string | null;
  baseUrl: string | null;
  platformTenantId: string | null;
  internalToken: string | null;
};

function normalizeBaseUrl(value: string | null | undefined) {
  return value?.trim().replace(/\/+$/, "") ?? null;
}

export function resolveCalendarAdminAccessState(
  link: CustomerJourneysRuntimeLink | null,
  env: CalendarAdminAccessEnv = getCrmEnv(),
): CalendarAdminAccessState {
  const overrideBaseUrl = normalizeBaseUrl(env.customerJourneysPlatformApiBaseUrlOverride);
  const baseUrl =
    overrideBaseUrl ??
    normalizeBaseUrl(link?.platform_api_base_url) ??
    normalizeBaseUrl(env.customerJourneysPlatformApiBaseUrl);
  const platformTenantId = link?.customerjourneys_tenant_id?.trim() || null;
  const internalToken = env.customerJourneysInternalApiToken?.trim() || null;

  if (!link) {
    return {
      status: "missing_runtime_link",
      ready: false,
      message:
        "Platform runtime link is not configured for this tenant yet. Ask an admin to finish provisioning the CustomerJourneys control-plane link.",
      baseUrl,
      platformTenantId,
      internalToken,
    };
  }

  if (!platformTenantId) {
    return {
      status: "missing_platform_tenant_id",
      ready: false,
      message:
        "Platform runtime link exists but no CustomerJourneys tenant id is configured for this CRM tenant yet.",
      baseUrl,
      platformTenantId,
      internalToken,
    };
  }

  if (!baseUrl) {
    return {
      status: "missing_platform_base_url",
      ready: false,
      message: "Platform API base URL is not configured for this tenant.",
      baseUrl,
      platformTenantId,
      internalToken,
    };
  }

  if (!internalToken) {
    return {
      status: "missing_internal_token",
      ready: false,
      message:
        "CustomerJourneys internal service token is not configured. Set CUSTOMERJOURNEYS_INTERNAL_API_TOKEN for this environment to use the calendar control plane.",
      baseUrl,
      platformTenantId,
      internalToken,
    };
  }

  return {
    status: "ready",
    ready: true,
    message: null,
    baseUrl,
    platformTenantId,
    internalToken,
  };
}

export function calendarAdminAccessErrorStatus(status: CalendarAdminAccessStatus) {
  return status === "ready" ? 200 : 503;
}
