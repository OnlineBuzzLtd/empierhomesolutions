import type { AddonState, CrmAddonKey, CrmRole } from "@/modules/crm/types";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { userCanManageSettings } from "@/modules/crm/lib/auth";

export const aiHubAddonKey = "ai_comms_hub" as const;

export type AiHubViewState = "locked" | "demo" | "enabled";

const defaultAddons: Record<CrmAddonKey, AddonState> = {
  ai_comms_hub: {
    addon_key: aiHubAddonKey,
    enabled: false,
    demo_enabled: true,
    display_name: "AI Hub",
    price_label: "From GBP 299/mo per company",
    cta_url: "https://customerjourneys.ai/en-GB/demo",
    summary: "Turn missed calls, chats, and out-of-hours enquiries into qualified CRM activity automatically.",
  },
};

export async function getAddonState(addonKey: CrmAddonKey): Promise<AddonState> {
  const fallback = defaultAddons[addonKey];
  if (!getCrmEnv().enabled) {
    return fallback;
  }

  try {
    const supabase = await createCrmServerClient();
    const { data, error } = await supabase.schema("crm").from("product_addons").select("*").eq("addon_key", addonKey).maybeSingle<AddonState>();
    if (error || !data) {
      return fallback;
    }
    return {
      ...fallback,
      ...data,
      addon_key: addonKey,
    };
  } catch {
    return fallback;
  }
}

export function resolveAiHubViewState(addon: AddonState, role: CrmRole | null | undefined): AiHubViewState {
  if (addon.enabled) {
    return "enabled";
  }

  if (addon.demo_enabled && userCanManageSettings(role)) {
    return "demo";
  }

  return "locked";
}
