"use server";

import { cookies } from "next/headers";

export type EngineerUiMode = "commusoft" | "classic";

export async function setUiPreference(value: EngineerUiMode) {
  const cookieStore = await cookies();
  cookieStore.set("engineer_ui", value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: "lax",
  });
}

export async function getUiPreference(): Promise<EngineerUiMode> {
  const cookieStore = await cookies();
  const value = cookieStore.get("engineer_ui")?.value;
  return value === "classic" ? "classic" : "commusoft";
}
