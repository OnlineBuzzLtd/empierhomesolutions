"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCrmEnv } from "@/modules/crm/lib/env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const env = getCrmEnv();
  if (!env.enabled || !env.url || !env.publishableKey) {
    return null;
  }

  browserClient = createBrowserClient(env.url, env.publishableKey);
  return browserClient;
}
