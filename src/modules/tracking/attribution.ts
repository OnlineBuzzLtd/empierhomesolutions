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
  return Object.keys(attribution).length > 0;
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
  if (typeof window === "undefined" || !hasAttributionData(attribution)) {
    return;
  }

  document.cookie = buildAttributionCookie(attribution);
  window.sessionStorage.setItem(ATTRIBUTION_SESSION_KEY, JSON.stringify(attribution));
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") {
    return {};
  }

  const sessionRaw = window.sessionStorage.getItem(ATTRIBUTION_SESSION_KEY);
  if (sessionRaw) {
    try {
      return JSON.parse(sessionRaw) as Attribution;
    } catch {
      window.sessionStorage.removeItem(ATTRIBUTION_SESSION_KEY);
    }
  }

  const cookieAttribution = getAttributionFromCookieString(document.cookie) ?? {};
  if (hasAttributionData(cookieAttribution)) {
    window.sessionStorage.setItem(ATTRIBUTION_SESSION_KEY, JSON.stringify(cookieAttribution));
  }

  return cookieAttribution;
}

export function readAttributionFromRequest(url: string, cookieHeader?: string | null): Attribution {
  const requestUrl = new URL(url);
  const fromQuery = parseAttributionFromSearchParams(requestUrl.searchParams, requestUrl.href);

  if (hasAttributionData(fromQuery)) {
    return fromQuery;
  }

  return getAttributionFromCookieString(cookieHeader ?? undefined) ?? {};
}
