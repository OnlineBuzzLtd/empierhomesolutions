import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyPlatformRequest } from "@/modules/platform/lib/platform-auth";

type IdentifierType = "phone" | "email" | "whatsapp" | "web_session" | "crm_contact" | "social_user";

type IdentifierHash = {
  type: IdentifierType;
  valueHash: string;
};

type CustomerRow = {
  id: string;
  tenant_id: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  postcode: string | null;
  archived: boolean | null;
  is_test?: boolean | null;
  is_demo?: boolean | null;
  record_deleted_at?: string | null;
  redacted_at?: string | null;
};

type JobRow = {
  id: string;
  customer_id: string;
  title: string | null;
  description: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string | null;
  assigned_engineer: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_test?: boolean | null;
  is_demo?: boolean | null;
  service?: { slug: string | null; name: string | null } | null;
  job_type?: { slug: string | null; name: string | null } | null;
};

async function resolveTenantId(request: Request) {
  const url = new URL(request.url);
  const directTenantId = url.searchParams.get("crmTenantId") ?? url.searchParams.get("tenantId");
  const workspaceId = url.searchParams.get("workspaceId");
  const customerJourneysTenantId =
    url.searchParams.get("customerJourneysTenantId") ?? url.searchParams.get("customerjourneysTenantId");

  const supabase = createCrmServiceRoleClient();
  const candidate = directTenantId ?? workspaceId;
  if (candidate) {
    const { data, error } = await supabase
      .schema("crm")
      .from("tenants")
      .select("id")
      .eq("id", candidate)
      .maybeSingle<{ id: string }>();
    if (error) throw error;
    if (data?.id) return data.id;
  }

  const runtimeTenantId = customerJourneysTenantId ?? workspaceId;
  if (runtimeTenantId) {
    const { data, error } = await supabase
      .schema("crm")
      .from("customerjourneys_runtime_links")
      .select("crm_tenant_id")
      .eq("customerjourneys_tenant_id", runtimeTenantId)
      .maybeSingle<{ crm_tenant_id: string }>();
    if (error) throw error;
    if (data?.crm_tenant_id) return data.crm_tenant_id;
  }

  return null;
}

export async function GET(request: Request) {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  const auth = verifyPlatformRequest(request, "", env.platformSharedSecret);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const tenantId = await resolveTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const identifierHashes = parseIdentifierHashes(new URL(request.url).searchParams.getAll("identifierHash"));
    if (identifierHashes.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const supabase = createCrmServiceRoleClient();
    const { data: customers, error: customersError } = await supabase
      .schema("crm")
      .from("customers")
      .select("id, tenant_id, phone, email, city, postcode, archived, is_test, is_demo, record_deleted_at, redacted_at")
      .eq("tenant_id", tenantId)
      .eq("archived", false)
      .is("record_deleted_at", null)
      .is("redacted_at", null)
      .limit(250)
      .returns<CustomerRow[]>();
    if (customersError) throw customersError;

    const match = findCustomerMatch(customers ?? [], identifierHashes);
    if (!match) {
      return new NextResponse(null, { status: 204 });
    }

    const { data: jobs, error: jobsError } = await supabase
      .schema("crm")
      .from("jobs")
      .select(
        "id, customer_id, title, description, scheduled_date, scheduled_time, status, assigned_engineer, created_at, updated_at, is_test, is_demo, service:services(slug,name), job_type:job_types(slug,name)",
      )
      .eq("tenant_id", tenantId)
      .eq("customer_id", match.customer.id)
      .is("record_deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<JobRow[]>();
    if (jobsError) throw jobsError;

    const nowIso = new Date().toISOString();
    return NextResponse.json(
      {
        tenantId,
        customerId: match.customer.id,
        matchedIdentifiers: match.identifiers.map((identifier) => ({
          type: identifier.type,
          valueHash: identifier.valueHash,
          confidence: 1,
        })),
        summary: `Known CRM customer with ${(jobs ?? []).length} recent job${(jobs ?? []).length === 1 ? "" : "s"}.`,
        recentJobs: (jobs ?? []).map((job) => projectJob(job, match.customer)),
        recentInteractions: [],
        warnings: [],
        source: {
          sourceType: "crm_customer_history",
          sourceId: `customer:${match.customer.id}`,
          tenantId,
          version: `history:${nowIso}`,
          lastUpdatedAt: nowIso,
          confidence: 1,
        },
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build customer history." },
      { status: 500 },
    );
  }
}

function parseIdentifierHashes(values: string[]): IdentifierHash[] {
  return values.flatMap((value) => {
    const [type, valueHash] = value.split(":");
    if (!isIdentifierType(type) || !valueHash || !/^[a-f0-9]{64}$/i.test(valueHash)) {
      return [];
    }
    return [{ type, valueHash: valueHash.toLowerCase() }];
  });
}

function findCustomerMatch(customers: CustomerRow[], identifiers: IdentifierHash[]) {
  for (const customer of customers) {
    const matched = identifiers.filter((identifier) => {
      if (identifier.type === "email") {
        return customer.email ? sha256(normalizeEmail(customer.email)) === identifier.valueHash : false;
      }
      if (identifier.type === "phone" || identifier.type === "whatsapp") {
        return customer.phone ? sha256(normalizePhone(customer.phone)) === identifier.valueHash : false;
      }
      if (identifier.type === "crm_contact") {
        return sha256(customer.id.toLowerCase()) === identifier.valueHash;
      }
      return false;
    });
    if (matched.length) {
      return { customer, identifiers: matched };
    }
  }
  return null;
}

function projectJob(job: JobRow, customer: CustomerRow) {
  const serviceKey = serviceKeyForJob(job);
  return {
    jobId: job.id,
    ...(serviceKey ? { serviceKey } : {}),
    serviceName: serviceNameForJob(job),
    status: job.status ?? "unknown",
    ...(job.scheduled_date ? { bookedAt: formatScheduledAt(job.scheduled_date, job.scheduled_time) } : {}),
    ...(isCompletedStatus(job.status) && job.scheduled_date ? { completedAt: job.scheduled_date } : {}),
    ...(safeArea(customer) ? { addressArea: safeArea(customer) } : {}),
    ...(job.assigned_engineer ? { engineerName: job.assigned_engineer } : {}),
    ...(job.description ? { outcome: job.description } : {}),
    isTest: Boolean(job.is_test ?? job.is_demo ?? customer.is_test ?? customer.is_demo),
  };
}

function serviceKeyForJob(job: JobRow) {
  const serviceSlug = job.service?.slug?.trim();
  const jobTypeSlug = job.job_type?.slug?.trim();
  if (serviceSlug && jobTypeSlug) return `${serviceSlug}:${jobTypeSlug}`;
  return serviceSlug || undefined;
}

function serviceNameForJob(job: JobRow) {
  const serviceName = job.service?.name?.trim();
  const jobTypeName = job.job_type?.name?.trim();
  if (serviceName && jobTypeName) return `${serviceName} - ${jobTypeName}`;
  return serviceName || job.title || "CRM job";
}

function safeArea(customer: CustomerRow) {
  const city = customer.city?.trim();
  if (city) return city;
  return customer.postcode?.trim().split(/\s+/)[0] ?? undefined;
}

function formatScheduledAt(date: string, time: string | null) {
  return time ? `${date}T${time}` : date;
}

function isCompletedStatus(status: string | null) {
  return Boolean(status && ["completed", "complete", "done", "closed"].includes(status.toLowerCase()));
}

function isIdentifierType(value: string | undefined): value is IdentifierType {
  return Boolean(
    value &&
      ["phone", "email", "whatsapp", "web_session", "crm_contact", "social_user"].includes(value),
  );
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const trimmed = value.replace(/^whatsapp:/i, "").trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  return digits ? `${hasLeadingPlus ? "+" : ""}${digits}` : "";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
