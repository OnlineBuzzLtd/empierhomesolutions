import { publicEnv } from "@/lib/env";
import type { Attribution } from "@/modules/tracking/attribution";

type CallNumberRules = {
  default: string;
  googleRepair?: string;
};

function parseRules(): CallNumberRules {
  const defaultRules: CallNumberRules = {
    default: publicEnv.defaultCallNumber,
  };

  if (!publicEnv.callNumberRules) {
    return defaultRules;
  }

  try {
    const parsed = JSON.parse(publicEnv.callNumberRules) as Partial<CallNumberRules>;
    return {
      default: parsed.default ?? defaultRules.default,
      googleRepair: parsed.googleRepair,
    };
  } catch {
    return defaultRules;
  }
}

export function resolveCallNumber(attribution: Attribution = {}): string {
  const rules = parseRules();
  const source = attribution.utm_source?.toLowerCase() ?? "";
  const medium = attribution.utm_medium?.toLowerCase() ?? "";
  const campaign = attribution.utm_campaign?.toLowerCase() ?? "";

  const paidMedium = !medium || ["cpc", "ppc", "paid", "paid-search"].includes(medium);

  if (source === "google" && paidMedium && campaign.includes("repair") && rules.googleRepair) {
    return rules.googleRepair;
  }

  return rules.default;
}

export function toTelHref(phoneNumber: string) {
  return `tel:${phoneNumber.replace(/\s+/g, "")}`;
}
