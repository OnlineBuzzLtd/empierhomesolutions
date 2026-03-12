import { getCrmEnv } from "@/modules/crm/lib/env";

export function getCrmSetupState() {
  const env = getCrmEnv();

  return {
    configured: env.enabled,
    message: env.enabled
      ? null
      : "CRM is not connected yet. Add the Supabase CRM environment variables to enable auth and data.",
  };
}
