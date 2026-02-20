import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

export async function POST(request: Request) {
  const serverEnv = getServerEnv();
  const providedSecret = request.headers.get("x-conversion-secret");

  if (providedSecret !== serverEnv.conversionApiSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "unauthorized",
          message: "Invalid conversion secret.",
        },
      },
      { status: 401 },
    );
  }

  const payload = await request.json().catch(() => null);

  return NextResponse.json({
    ok: true,
    conversion: {
      receivedAt: new Date().toISOString(),
      payload,
    },
  });
}
