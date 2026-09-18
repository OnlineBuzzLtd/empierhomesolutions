import { publicEnv } from "@/lib/env";

type HeadlineVariant = "control" | "speed";
type CtaVariant = "call-now" | "speak-to-engineer";
type TrustOrderVariant = "default" | "rating-first";
type FeatureState = "off" | "on";

type AbFlags = {
  headline: HeadlineVariant;
  cta: CtaVariant;
  trustOrder: TrustOrderVariant;
  reviews: FeatureState;
  webchatPreflight: FeatureState;
};

const defaultFlags: AbFlags = {
  headline: "control",
  cta: "call-now",
  trustOrder: "default",
  reviews: "off",
  webchatPreflight: "off",
};

function featureState(value: unknown, fallback: FeatureState): FeatureState {
  return value === "on" || value === "off" ? value : fallback;
}

export function getAbFlags(): AbFlags {
  const raw = publicEnv.abFlags;
  if (!raw) {
    return defaultFlags;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AbFlags>;
    return {
      headline: parsed.headline ?? defaultFlags.headline,
      cta: parsed.cta ?? defaultFlags.cta,
      trustOrder: parsed.trustOrder ?? defaultFlags.trustOrder,
      reviews: featureState(parsed.reviews, defaultFlags.reviews),
      webchatPreflight: featureState(parsed.webchatPreflight, defaultFlags.webchatPreflight),
    };
  } catch {
    return defaultFlags;
  }
}
