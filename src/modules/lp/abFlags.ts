import { publicEnv } from "@/lib/env";

type HeadlineVariant = "control" | "speed";
type CtaVariant = "call-now" | "speak-to-engineer";
type TrustOrderVariant = "default" | "rating-first";

type AbFlags = {
  headline: HeadlineVariant;
  cta: CtaVariant;
  trustOrder: TrustOrderVariant;
};

const defaultFlags: AbFlags = {
  headline: "control",
  cta: "call-now",
  trustOrder: "default",
};

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
    };
  } catch {
    return defaultFlags;
  }
}
