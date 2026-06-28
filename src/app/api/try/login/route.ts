import { NextResponse } from "next/server";
import {
  DEMO_SESSION_COOKIE,
  createSessionToken,
  demoSessionCookieOptions,
  isDemoCrmEnabled,
  verifyCredentials,
} from "@/modules/demo-crm/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isDemoCrmEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let email = "";
  let password = "";
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_SESSION_COOKIE, createSessionToken(), demoSessionCookieOptions);
  return response;
}
