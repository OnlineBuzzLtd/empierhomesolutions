import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { assertCrmAdminEnv, assertCrmEnv } from "@/modules/crm/lib/env";

export async function createCrmServerClient() {
  const env = assertCrmEnv();
  const cookieStore = await cookies();

  return createServerClient(env.url!, env.publishableKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export function createCrmServiceRoleClient() {
  const env = assertCrmAdminEnv();
  return createClient(env.url!, env.serviceRoleKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
