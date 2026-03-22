import { crmDemoScenarioKey, type DemoStep } from "@/modules/crm/lib/demo";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

type DemoOpenRouteMap = Partial<Record<string, string>>;

export async function resolveCrmDemoSteps(steps: DemoStep[], active: boolean) {
  if (!active) {
    return steps;
  }

  const openRoutes = await getCrmDemoOpenRoutes();
  return steps.map((step) => ({
    ...step,
    openRoute: openRoutes[step.route] ?? step.route,
  }));
}

async function getCrmDemoOpenRoutes(): Promise<DemoOpenRouteMap> {
  if (!getCrmEnv().enabled) {
    return {};
  }

  const supabase = await createCrmServerClient();
  const [customer, job, quote, invoice] = await Promise.all([
    supabase.schema("crm").from("customers").select("id").eq("is_demo", true).eq("demo_scenario_key", crmDemoScenarioKey).eq("archived", false).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.schema("crm").from("jobs").select("id").eq("is_demo", true).eq("demo_scenario_key", crmDemoScenarioKey).order("scheduled_date", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.schema("crm").from("quotes").select("id").eq("is_demo", true).eq("demo_scenario_key", crmDemoScenarioKey).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.schema("crm").from("invoices").select("id").eq("is_demo", true).eq("demo_scenario_key", crmDemoScenarioKey).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    "/customers": customer.data?.id ? `/customers/${customer.data.id}` : "/customers",
    "/jobs": job.data?.id ? `/jobs/${job.data.id}` : "/jobs",
    "/quotes": quote.data?.id ? `/quotes/${quote.data.id}` : "/quotes",
    "/invoices": invoice.data?.id ? `/invoices/${invoice.data.id}` : "/invoices",
  };
}
