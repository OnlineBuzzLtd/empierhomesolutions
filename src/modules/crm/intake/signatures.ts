import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  try {
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function forwardedUrl(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return null;
  }
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const url = new URL(request.url);
  return `${proto}://${host}${url.pathname}${url.search}`;
}

export function collectTwilioSignatureUrls(request: Request) {
  return [...new Set([request.url, forwardedUrl(request)].filter((value): value is string => Boolean(value)))];
}

export function computeTwilioSignature(url: string, params: Record<string, string>, authToken: string) {
  const hmac = createHmac("sha1", authToken);
  hmac.update(
    `${url}${Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key] ?? ""}`)
      .join("")}`,
  );
  return hmac.digest("base64");
}

export function verifyTwilioSignature(input: {
  request: Request;
  params: Record<string, string>;
  authToken: string;
}) {
  const signature = input.request.headers.get("x-twilio-signature")?.trim();
  if (!signature) {
    return false;
  }
  return collectTwilioSignatureUrls(input.request).some((url) =>
    safeEqual(computeTwilioSignature(url, input.params, input.authToken), signature),
  );
}

export function verifySha256Signature(input: {
  rawBody: string;
  secret: string;
  signatureHeader: string | null;
  prefix?: string;
}) {
  const provided = input.signatureHeader?.trim();
  if (!provided) {
    return false;
  }
  const digest = createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
  const expected = `${input.prefix ?? ""}${digest}`;
  return safeEqual(expected, provided) || safeEqual(digest, provided);
}

export function verifyStaticSecret(input: {
  configuredSecret: string | null | undefined;
  providedSecret: string | null | undefined;
}) {
  if (!input.configuredSecret || !input.providedSecret) {
    return false;
  }
  return safeEqual(input.configuredSecret, input.providedSecret);
}
