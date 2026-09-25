import { NextResponse, type NextRequest } from "next/server";

const ingressPath =
  /^\/api\/(?:platform\/(?:events|catalog|calendar\/(?:connection|resources|check-availability|events(?:\/[^/]+(?:\/confirm)?)?))|lead|public\/(?:webchat\/(?:sessions|messages|close)|bookings\/[^/]+(?:\/(?:cancel|reschedule))?)|webhooks\/twilio\/inbound)$/;

/** Disabled by default. Forward exactly once; never fall back after an uncertain response. */
export async function handleCrmV2Cutover(request: NextRequest): Promise<NextResponse | null> {
  const configured = process.env.CRM_V2_ORIGIN;
  if (!configured) return null;
  const origin = new URL(configured);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password) {
    return NextResponse.json({ error: "Invalid CRM v2 origin configuration." }, { status: 503 });
  }
  const legacyOrigins = (
    process.env.CRM_V2_LEGACY_ORIGINS ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://empire-home-solutions.vercel.app"
  )
    .split(",")
    .map((value) => value.trim());
  if (!legacyOrigins.includes(request.nextUrl.origin)) return null;
  const path = request.nextUrl.pathname;
  const quotesEnabled = process.env.CRM_V2_QUOTES_ENABLED === "true";
  const ingressEnabled = process.env.CRM_V2_INGRESS_ENABLED === "true";
  if (
    (quotesEnabled && /^\/(?:q|quotes)(?:\/|$)/.test(path)) ||
    (ingressEnabled && /^\/booking\//.test(path))
  ) {
    return NextResponse.redirect(new URL(path + request.nextUrl.search, origin), 307);
  }
  if (
    quotesEnabled &&
    (/^\/api\/crm\/quotes(?:\/|$)/.test(path) || /^\/api\/crm\/jobs\/[^/]+\/draft-quote$/.test(path))
  ) {
    return NextResponse.json(
      {
        error: "Quotes are now managed in the new CRM. Open the link to continue.",
        redirect_url: new URL("/quotes", origin).toString(),
      },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }
  const publicQuote = quotesEnabled && /^\/api\/public\/quotes\/[^/]+(?:\/(?:accept|reject))?$/.test(path);
  if (!publicQuote && !(ingressEnabled && ingressPath.test(path))) return null;
  const secret = process.env.CRM_V2_FORWARDING_SECRET;
  if (!secret) return NextResponse.json({ error: "CRM forwarding is not configured." }, { status: 503 });
  if (Number(request.headers.get("content-length")) > 1048576)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  const body = ["GET", "HEAD"].includes(request.method) ? "" : await request.text();
  if (new TextEncoder().encode(body).length > 1048576)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${request.method}.${request.url}.${body}`),
  );
  const signature = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const headers = new Headers(request.headers);
  for (const name of ["host", "content-length", "connection", "accept-encoding"]) headers.delete(name);
  headers.set("x-empire-original-url", request.url);
  headers.set("x-empire-forwarded-at", timestamp);
  headers.set("x-empire-forwarded-signature", signature);
  try {
    const response = await fetch(new URL(path + request.nextUrl.search, origin), {
      method: request.method,
      headers,
      body: body || undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    const responseHeaders = new Headers(response.headers);
    for (const name of ["content-encoding", "content-length", "transfer-encoding", "set-cookie"])
      responseHeaders.delete(name);
    responseHeaders.set("cache-control", "no-store");
    return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return NextResponse.json(
      { error: "CRM forwarding unavailable. Retry with the original idempotency key." },
      { status: 502 },
    );
  }
}
