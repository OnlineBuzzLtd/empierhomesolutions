import { NextResponse } from "next/server";
import { crmDemoCookieName, crmDemoScenarioKey } from "@/modules/crm/lib/demo";
import { requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export async function POST() {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const response = NextResponse.json({
    ok: true,
    active: true,
    mode: "demo",
    scenarioKey: crmDemoScenarioKey,
  });
  response.cookies.set(crmDemoCookieName, crmDemoScenarioKey, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 4,
  });
  return response;
}
