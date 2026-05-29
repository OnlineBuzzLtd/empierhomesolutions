"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/modules/crm/lib/supabase-browser";
import { clearCrmClientCache } from "@/modules/crm/components/client/CrmClientRuntime";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    clearCrmClientCache();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
    >
      Sign Out
    </button>
  );
}
