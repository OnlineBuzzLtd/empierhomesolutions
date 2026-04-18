import { notFound } from "next/navigation";
import { TestConsole } from "./TestConsole";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Local Test Console — Tenant 1",
  description: "Raw local testing UI for the Empire Home Solutions tenant (CRM + agent).",
};

function isEnabled() {
  return process.env.DEV_TEST_UI_ENABLED === "1" || process.env.NODE_ENV !== "production";
}

export default function LocalTestPage() {
  if (!isEnabled()) {
    notFound();
  }

  return <TestConsole />;
}
