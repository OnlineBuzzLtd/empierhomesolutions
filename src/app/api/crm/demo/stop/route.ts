import { NextResponse } from "next/server";
import { crmDemoCookieName } from "@/modules/crm/lib/demo";
import { requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export async function POST() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const response = NextResponse.json({
    ok: true,
    active: false,
    mode: "live",
  });
  response.cookies.set(crmDemoCookieName, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}
