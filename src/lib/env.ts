import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_GTM_ID: z.string().optional().default(""),
  NEXT_PUBLIC_GA4_ID: z.string().optional().default(""),
  NEXT_PUBLIC_GOOGLE_ADS_ID: z.string().optional().default(""),
  NEXT_PUBLIC_CALL_NUMBER: z.string().min(6),
  NEXT_PUBLIC_CALL_NUMBER_RULES: z.string().optional().default(""),
  NEXT_PUBLIC_LP_AB_FLAGS: z.string().optional().default(""),
});

const serverEnvSchema = z.object({
  FORM_WEBHOOK_URL: z.string().url(),
  CONVERSION_API_SECRET: z.string().min(8),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  LEAD_ORIGIN_ALLOWLIST: z.string().optional().default(""),
  SIGNUP_MODE: z.enum(["invite", "public"]).optional().default("invite"),
  DEV_TEST_UI_ENABLED: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .default("0"),
  NODE_ENV: z.string().optional().default("development"),
  NEXT_PUBLIC_APP_ENV: z
    .enum(["development", "preview", "production"])
    .optional()
    .default("development"),
});

function formatErrors(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

function parsePublicEnv() {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
    NEXT_PUBLIC_GA4_ID: process.env.NEXT_PUBLIC_GA4_ID,
    NEXT_PUBLIC_GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    NEXT_PUBLIC_CALL_NUMBER: process.env.NEXT_PUBLIC_CALL_NUMBER,
    NEXT_PUBLIC_CALL_NUMBER_RULES: process.env.NEXT_PUBLIC_CALL_NUMBER_RULES,
    NEXT_PUBLIC_LP_AB_FLAGS: process.env.NEXT_PUBLIC_LP_AB_FLAGS,
  });
  if (!result.success) {
    throw new Error(`Invalid public environment variables: ${formatErrors(result.error)}`);
  }

  return {
    siteUrl: result.data.NEXT_PUBLIC_SITE_URL,
    gtmId: result.data.NEXT_PUBLIC_GTM_ID,
    ga4Id: result.data.NEXT_PUBLIC_GA4_ID,
    googleAdsId: result.data.NEXT_PUBLIC_GOOGLE_ADS_ID,
    defaultCallNumber: result.data.NEXT_PUBLIC_CALL_NUMBER,
    callNumberRules: result.data.NEXT_PUBLIC_CALL_NUMBER_RULES,
    abFlags: result.data.NEXT_PUBLIC_LP_AB_FLAGS,
  };
}

let cachedServerEnv: ReturnType<typeof parseServerEnv> | null = null;

function parseServerEnv() {
  const result = serverEnvSchema.safeParse({
    FORM_WEBHOOK_URL: process.env.FORM_WEBHOOK_URL,
    CONVERSION_API_SECRET: process.env.CONVERSION_API_SECRET,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    LEAD_ORIGIN_ALLOWLIST: process.env.LEAD_ORIGIN_ALLOWLIST,
    SIGNUP_MODE: process.env.SIGNUP_MODE,
    DEV_TEST_UI_ENABLED: process.env.DEV_TEST_UI_ENABLED,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  });
  if (!result.success) {
    throw new Error(`Invalid server environment variables: ${formatErrors(result.error)}`);
  }

  const devTestUiEnabled = ["1", "true"].includes(result.data.DEV_TEST_UI_ENABLED ?? "0");
  const appEnv = result.data.NEXT_PUBLIC_APP_ENV ?? "development";
  const isProduction = appEnv === "production" || result.data.NODE_ENV === "production";

  return {
    formWebhookUrl: result.data.FORM_WEBHOOK_URL,
    conversionApiSecret: result.data.CONVERSION_API_SECRET,
    upstashRedisUrl: result.data.UPSTASH_REDIS_REST_URL,
    upstashRedisToken: result.data.UPSTASH_REDIS_REST_TOKEN,
    turnstileSecretKey: result.data.TURNSTILE_SECRET_KEY,
    turnstileSiteKey: result.data.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    leadOriginAllowlist: result.data.LEAD_ORIGIN_ALLOWLIST,
    signupMode: result.data.SIGNUP_MODE ?? "invite",
    devTestUiEnabled: devTestUiEnabled && !isProduction,
    appEnv,
    isProduction,
  };
}

export const publicEnv = parsePublicEnv();

export function getServerEnv() {
  if (!cachedServerEnv) {
    cachedServerEnv = parseServerEnv();
  }

  return cachedServerEnv;
}
