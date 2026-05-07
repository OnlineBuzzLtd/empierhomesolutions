import { notFound } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { TestConsole } from "./TestConsole";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Local Test Console - Tenant 1",
  description: "Raw local testing UI for the Empire Home Solutions tenant (CRM + agent).",
};

function isEnabled() {
  const env = getServerEnv();
  // Hard block in production, regardless of any DEV_TEST_UI_ENABLED override.
  // The /test console exposes internal tenant fixtures and MUST never be
  // reachable on prod deployments.
  if (env.isProduction) return false;
  return env.devTestUiEnabled || !env.isProduction;
}

export default function LocalTestPage() {
  if (!isEnabled()) {
    notFound();
  }

  return <TestConsole />;
}
