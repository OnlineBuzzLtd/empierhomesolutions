import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

/**
 * Mock webhook endpoint used by E2E tests and local dev. Must return 404 in
 * production to avoid exposing a trivially-forwardable sink surface.
 */
export async function POST(request: Request) {
  const env = getServerEnv();
  if (env.isProduction) {
    return new NextResponse(null, { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  return NextResponse.json({
    ok: true,
    received: payload,
  });
}
