function normalizeEnv(value: string | undefined) {
  return value && value.trim().length > 0 ? value : null;
}

export function getCrmEnv() {
  const url = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const serviceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    url,
    publishableKey,
    serviceRoleKey,
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
