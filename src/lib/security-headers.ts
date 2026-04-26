import type { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

/**
 * Generates a cryptographically strong base64 nonce suitable for use in CSP
 * `script-src 'nonce-...'` directives.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

type CspOptions = {
  nonce: string;
  report?: boolean;
};

/**
 * Build a per-request Content-Security-Policy. Allows inline scripts only when
 * they carry the matching nonce, plus the Cloudflare Turnstile and Google Tag
 * Manager + GA4 hosts that this app loads scripts from.
 *
 * NB: Next.js dev server needs 'unsafe-eval' and 'unsafe-inline' to work (React
 * Fast Refresh, Turbopack HMR), so we relax in dev only.
 */
export function buildContentSecurityPolicy({ nonce }: CspOptions): string {
  const env = getServerEnv();
  const isProd = env.isProduction;

  const scriptExtras = [
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://challenges.cloudflare.com",
  ];
  const connectExtras = [
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://challenges.cloudflare.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
  ];

  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' ${scriptExtras.join(" ")}`
    : `'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' ${scriptExtras.join(" ")}`;

  const styleSrc = isProd ? `'self' 'unsafe-inline'` : `'self' 'unsafe-inline'`;

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src ${scriptSrc}`,
    `script-src-elem ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src 'self' ${connectExtras.join(" ")}`,
    `frame-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `media-src 'self' data: blob:`,
    isProd ? `upgrade-insecure-requests` : "",
  ].filter(Boolean);

  return directives.join("; ");
}

/**
 * Applies the standard browser security headers to a NextResponse.
 *
 * Headers set:
 *  - Strict-Transport-Security (prod only)
 *  - Content-Security-Policy (via nonce)
 *  - Referrer-Policy
 *  - Permissions-Policy
 *  - X-Content-Type-Options
 *  - X-Frame-Options (alongside frame-ancestors for older UAs)
 */
export function applySecurityHeaders(
  request: NextRequest,
  response: NextResponse,
  nonce: string,
): NextResponse {
  const env = getServerEnv();

  // The nonce is stored in a request header so that server components + layout
  // files can read it and decorate their <Script nonce={...} /> tags.
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy({ nonce }));
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  );

  if (env.isProduction && (request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https")) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}
