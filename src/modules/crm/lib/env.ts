import { parseAllowlistEnv } from "@/modules/platform/lib/synthetic-number-guard";

function normalizeEnv(value: string | undefined) {
  return value && value.trim().length > 0 ? value : null;
}

export function getCrmEnv() {
  const url = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const serviceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const platformSharedSecret = normalizeEnv(process.env.PLATFORM_SHARED_SECRET);
  const demoConsoleAllowlist = parseAllowlistEnv(process.env.DEMO_CONSOLE_ALLOWLIST);
  const agenticPlatformEventWebhookUrl = normalizeEnv(process.env.AGENTIC_PLATFORM_EVENT_WEBHOOK_URL);
  const liveAgentUrl = normalizeEnv(process.env.AGENTIC_LIVE_AGENT_URL);
  const liveAgentToken = normalizeEnv(process.env.AGENTIC_LIVE_AGENT_TOKEN);
  const liveAgentTimeoutMs = Number.parseInt(process.env.AGENTIC_LIVE_AGENT_TIMEOUT_MS ?? "15000", 10);
  const customerJourneysPlatformApiBaseUrl = normalizeEnv(process.env.CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL);
  const customerJourneysPlatformApiBaseUrlOverride = normalizeEnv(
    process.env.CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL_OVERRIDE,
  );
  const customerJourneysAdminApiToken = normalizeEnv(process.env.CUSTOMERJOURNEYS_ADMIN_API_TOKEN);
  const customerJourneysInternalApiToken = normalizeEnv(process.env.CUSTOMERJOURNEYS_INTERNAL_API_TOKEN);
  const twilioAccountSid = normalizeEnv(process.env.TWILIO_ACCOUNT_SID);
  const twilioAuthToken = normalizeEnv(process.env.TWILIO_AUTH_TOKEN);
  const twilioDefaultNumberPoolSid = normalizeEnv(process.env.TWILIO_DEFAULT_NUMBER_POOL_SID);
  const postmarkInboundWebhookSecret = normalizeEnv(process.env.POSTMARK_INBOUND_WEBHOOK_SECRET);
  const googleLeadAdsVerifyToken = normalizeEnv(process.env.GOOGLE_LEAD_ADS_VERIFY_TOKEN);
  const googleLeadAdsWebhookSecret = normalizeEnv(process.env.GOOGLE_LEAD_ADS_WEBHOOK_SECRET);
  const metaLeadAdsVerifyToken = normalizeEnv(process.env.META_LEAD_ADS_VERIFY_TOKEN);
  const metaLeadAdsAppSecret = normalizeEnv(process.env.META_LEAD_ADS_APP_SECRET);
  const stripeSecretKey = normalizeEnv(process.env.STRIPE_SECRET_KEY);
  const stripeWebhookSecret = normalizeEnv(process.env.STRIPE_WEBHOOK_SECRET);
  const gocardlessAccessToken = normalizeEnv(process.env.GOCARDLESS_ACCESS_TOKEN);
  const gocardlessWebhookSecret = normalizeEnv(process.env.GOCARDLESS_WEBHOOK_SECRET);
  const gocardlessEnvironment = normalizeEnv(process.env.GOCARDLESS_ENVIRONMENT) ?? "sandbox";
  const serviceM8WebhookSecret = normalizeEnv(process.env.SERVICEM8_WEBHOOK_SECRET);
  const joblogicWebhookSecret = normalizeEnv(process.env.JOBLOGIC_WEBHOOK_SECRET);
  const crmE2ePlatformFixturesEnabled = process.env.CRM_E2E_PLATFORM_FIXTURES === "1";
  const vercelApiToken = normalizeEnv(process.env.VERCEL_API_TOKEN);
  const vercelProjectId = normalizeEnv(process.env.VERCEL_PROJECT_ID);
  const vercelTeamId = normalizeEnv(process.env.VERCEL_TEAM_ID);
  const crmTenantRootDomain =
    normalizeEnv(process.env.CRM_TENANT_ROOT_DOMAIN) ?? "crm.customerjourneys.ai";
  const cronSecret = normalizeEnv(process.env.CRON_SECRET);

  return {
    url,
    publishableKey,
    serviceRoleKey,
    platformSharedSecret,
    demoConsoleAllowlist,
    agenticPlatformEventWebhookUrl,
    liveAgentUrl,
    liveAgentToken,
    liveAgentTimeoutMs: Number.isFinite(liveAgentTimeoutMs) && liveAgentTimeoutMs > 0 ? liveAgentTimeoutMs : 15000,
    customerJourneysPlatformApiBaseUrl,
    customerJourneysPlatformApiBaseUrlOverride,
    customerJourneysAdminApiToken,
    customerJourneysInternalApiToken,
    customerJourneysBridgeEnabled: Boolean(customerJourneysPlatformApiBaseUrl),
    twilioAccountSid,
    twilioAuthToken,
    twilioDefaultNumberPoolSid,
    twilioProvisioningEnabled: Boolean(twilioAccountSid && twilioAuthToken),
    postmarkInboundWebhookSecret,
    googleLeadAdsVerifyToken,
    googleLeadAdsWebhookSecret,
    metaLeadAdsVerifyToken,
    metaLeadAdsAppSecret,
    stripeSecretKey,
    stripeWebhookSecret,
    gocardlessAccessToken,
    gocardlessWebhookSecret,
    gocardlessEnvironment,
    serviceM8WebhookSecret,
    joblogicWebhookSecret,
    crmE2ePlatformFixturesEnabled,
    vercelApiToken,
    vercelProjectId,
    vercelTeamId,
    crmTenantRootDomain,
    cronSecret,
    enabled: Boolean(url && publishableKey),
    adminEnabled: Boolean(url && serviceRoleKey),
  };
}

export function assertCrmEnv() {
  const env = getCrmEnv();

  if (!env.enabled) {
    throw new Error("Supabase CRM environment variables are not configured.");
  }

  return env;
}

export function assertCrmAdminEnv() {
  const env = getCrmEnv();

  if (!env.url || !env.serviceRoleKey) {
    throw new Error("Supabase CRM admin environment variables are not configured.");
  }

  return env;
}
