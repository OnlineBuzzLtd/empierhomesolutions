import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_GTM_ID: z.string().optional().default(""),
  NEXT_PUBLIC_GA4_ID: z.string().optional().default(""),
  NEXT_PUBLIC_CALL_NUMBER: z.string().min(6),
  NEXT_PUBLIC_CALL_NUMBER_RULES: z.string().optional().default(""),
  NEXT_PUBLIC_LP_AB_FLAGS: z.string().optional().default(""),
});

const serverEnvSchema = z.object({
  FORM_WEBHOOK_URL: z.string().url(),
  CONVERSION_API_SECRET: z.string().min(8),
});

function formatErrors(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

function parsePublicEnv() {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
    NEXT_PUBLIC_GA4_ID: process.env.NEXT_PUBLIC_GA4_ID,
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
  });
  if (!result.success) {
    throw new Error(`Invalid server environment variables: ${formatErrors(result.error)}`);
  }

  return {
    formWebhookUrl: result.data.FORM_WEBHOOK_URL,
    conversionApiSecret: result.data.CONVERSION_API_SECRET,
  };
}

export const publicEnv = parsePublicEnv();

export function getServerEnv() {
  if (!cachedServerEnv) {
    cachedServerEnv = parseServerEnv();
  }

  return cachedServerEnv;
}
