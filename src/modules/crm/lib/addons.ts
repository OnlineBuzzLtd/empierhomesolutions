import type { AddonState, CrmAddonKey, CrmRole, EngineerAiAssistState } from "@/modules/crm/types";

export const aiHubAddonKey = "ai_comms_hub" as const;

const enabledAddons: Record<CrmAddonKey, AddonState> = {
  ai_comms_hub: {
    addon_key: aiHubAddonKey,
    enabled: true,
    demo_enabled: true,
    display_name: "AI Hub",
    price_label: "",
    cta_url: null,
    summary: "Turn missed calls, chats, and out-of-hours enquiries into qualified CRM activity automatically.",
  },
};

export async function getAddonState(addonKey: CrmAddonKey): Promise<AddonState> {
  return enabledAddons[addonKey];
}

export function resolveEngineerAiAssistState(
  _addon: AddonState,
  _role: CrmRole | null | undefined,
  _demoModeActive: boolean,
): EngineerAiAssistState {
  return "enabled";
}
