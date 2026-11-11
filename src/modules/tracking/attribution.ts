import { getMeasurementConsent } from "./measurement-consent";

const ATTRIBUTION_COOKIE = "ehs_attribution";
const ATTRIBUTION_SESSION_KEY = "ehs_attribution";
const ATTRIBUTION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  msclkid?: string;
  oppref?: string;
  landing_url?: string;
};

const allowedKeys: (keyof Attribution)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "msclkid",
];

function normalizeValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.trim() || undefined;
}

export function parseAttributionFromSearchParams(
  searchParams: URLSearchParams,
  landingUrl?: string,
): Attribution {
  const attribution: Attribution = {};

  for (const key of allowedKeys) {
    const value = normalizeValue(searchParams.get(key) ?? undefined);
    if (value) {
      attribution[key] = value;
    }
  }

  if (landingUrl) {
    attribution.landing_url = landingUrl;
  }

  return attribution;
}

export function hasAttributionData(attribution: Attribution) {
  return Object.entries(attribution).some(([key, value]) => key !== "landing_url" && Boolean(value));
}

export function serializeAttribution(attribution: Attribution) {
  return encodeURIComponent(JSON.stringify(attribution));
}

export function parseSerializedAttribution(serializedValue: string | undefined | null): Attribution | null {
  if (!serializedValue) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(serializedValue);
    const parsed = JSON.parse(decoded) as Attribution;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function buildAttributionCookie(attribution: Attribution) {
  return `${ATTRIBUTION_COOKIE}=${serializeAttribution(attribution)}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export function getAttributionFromCookieString(cookieString: string | undefined): Attribution | null {
  if (!cookieString) {
    return null;
  }

  const entry = cookieString
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(`${ATTRIBUTION_COOKIE}=`));

  if (!entry) {
    return null;
  }

  return parseSerializedAttribution(entry.split("=").slice(1).join("="));
}

export function persistAttribution(attribution: Attribution) {
  if (typeof window === "undefined" || !hasAttributionData(attribution)) return;
  // OpenAI owns the consent-controlled __oppref cookie. Don't duplicate it.
  const stored = { ...attribution };
  delete stored.oppref;
  try {
    document.cookie = buildAttributionCookie(stored);
    window.sessionStorage.setItem(ATTRIBUTION_SESSION_KEY, JSON.stringify(stored));
  } catch {
    // Storage restrictions must not prevent someone submitting an enquiry.
  }
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  let stored: Attribution = {};
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_SESSION_KEY);
    stored = raw ? JSON.parse(raw) : getAttributionFromCookieString(document.cookie) ?? {};
  } catch {
    // Fall back to the current URL if browser storage is unavailable.
  }
  const query = parseAttributionFromSearchParams(new URLSearchParams(window.location.search), window.location.href);
  const result = hasAttributionData(query) ? query : { ...stored, landing_url: stored.landing_url || query.landing_url };
  delete result.oppref;
  if (getMeasurementConsent() === "granted") {
    const raw = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("__oppref="));
    try {
      const reference = new URLSearchParams(window.location.search).get("oppref") || (raw ? decodeURIComponent(raw.slice(9)) : undefined);
      if (reference && reference.length <= 4096) result.oppref = reference;
    } catch {
      // Ignore malformed cookie encoding; preserve the enquiry itself.
    }
  }
  return result;
}

export function readAttributionFromRequest(url: string, cookieHeader?: string | null): Attribution {
  const requestUrl = new URL(url);
  const fromQuery = parseAttributionFromSearchParams(requestUrl.searchParams, requestUrl.href);

  if (hasAttributionData(fromQuery)) {
    return fromQuery;
  }

  return getAttributionFromCookieString(cookieHeader ?? undefined) ?? {};
}
