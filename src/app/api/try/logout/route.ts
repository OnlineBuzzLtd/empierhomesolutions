import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/modules/demo-crm/auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
