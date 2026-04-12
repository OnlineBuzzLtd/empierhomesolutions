import { z } from "zod";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

const searchParamsSchema = z.object({
  q: z.string().trim().min(2, "Enter at least 2 characters to search."),
  type: z.enum(["customer", "job", "all"]).default("all"),
});

type CustomerSearchRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  postcode: string | null;
};

type JobSearchRow = {
  id: string;
  customer_id: string | null;
  title: string | null;
  status: string | null;
  scheduled_date: string | null;
};

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function matchesSearch(rowValues: Array<string | null | undefined>, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  return rowValues.some((value) => normalizeSearchValue(value).includes(normalizedQuery));
}

async function searchCustomers(tenantId: string, q: string, supabase: Awaited<ReturnType<typeof import("@/modules/crm/lib/supabase-server").createCrmServerClient>>) {
  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .select("id, full_name, phone, email, postcode")
    .eq("tenant_id", tenantId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return ((data ?? []) as CustomerSearchRow[])
    .filter((row) => matchesSearch([row.id, row.full_name, row.phone, row.email, row.postcode], q))
    .slice(0, 8);
}

async function searchJobs(tenantId: string, q: string, supabase: Awaited<ReturnType<typeof import("@/modules/crm/lib/supabase-server").createCrmServerClient>>) {
  const { data, error } = await supabase
    .schema("crm")
    .from("jobs")
    .select("id, customer_id, title, status, scheduled_date")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return ((data ?? []) as JobSearchRow[])
    .filter((row) => matchesSearch([row.id, row.customer_id, row.title, row.status, row.scheduled_date], q))
    .slice(0, 8);
}

export async function GET(request: Request) {
  try {
    const auth = await requireCrmApiUser(["management", "admin", "sales", "accounts"]);
    if ("error" in auth) {
      return auth.error;
    }

    const url = new URL(request.url);
    const parsed = searchParamsSchema.safeParse({
      q: url.searchParams.get("q") ?? "",
      type: url.searchParams.get("type") ?? "all",
    });

    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid search request.");
    }

    const { supabase, tenant } = auth.session;
    const { q, type } = parsed.data;

    const customers = type === "job" ? [] : await searchCustomers(tenant.id, q, supabase);
    const jobs = type === "customer" ? [] : await searchJobs(tenant.id, q, supabase);

    return jsonSuccess({ customers, jobs });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to search relink candidates.", 400);
  }
}
