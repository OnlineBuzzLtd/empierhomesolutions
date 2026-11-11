import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Exercises the real CRM intake path in submitLeadToWebhook against a fake
 * Supabase client, to prove the ads conversion ID is derived from the saved
 * CRM lead (new or deduplicated) and never issued when the save fails.
 */

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

type Op = { method: string; args: unknown[] };
type Resolver = (table: string, ops: Op[]) => { data: unknown; error: { message: string } | null };

const state = vi.hoisted(() => ({ resolver: null as unknown as Resolver, writes: [] as { table: string; ops: Op[] }[] }));

function builder(table: string) {
  const ops: Op[] = [];
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            try {
              if (ops.some((op) => op.method === "insert" || op.method === "update")) state.writes.push({ table, ops });
              resolve(state.resolver(table, ops));
            } catch (error) {
              reject(error);
            }
          };
        }
        return (...args: unknown[]) => {
          ops.push({ method: prop, args });
          return proxy;
        };
      },
    },
  );
  return proxy;
}

vi.mock("@/modules/crm/lib/env", () => ({ getCrmEnv: () => ({ adminEnabled: true }) }));
vi.mock("@/modules/crm/notifications/lead-alerts", () => ({ sendWebsiteLeadAlertSms: async () => ({ ok: true }) }));
vi.mock("@/modules/forms/api/landing-tenant", () => ({
  resolveLandingPageTenantId: async () => TENANT_ID,
  tenantIdFromSlug: async () => TENANT_ID,
}));
vi.mock("@/modules/crm/lib/supabase-server", () => ({
  createCrmServiceRoleClient: () => ({ schema: () => ({ from: (table: string) => builder(table) }) }),
}));

const has = (ops: Op[], method: string) => ops.some((op) => op.method === method);

const lead = {
  name: "Test Person",
  email: "",
  house_name_number: "12",
  street: "High Street",
  postcode: "UB8 1AA",
  phone: "07911123456",
  issue: "No heating and an error code.",
  companyWebsite: "",
  pagePath: "/offers/boiler-repair",
  service: "boiler-repair",
  location: "Uxbridge",
  leadType: "repair" as const,
  origin: "https://empirehomesolutions.co.uk",
  attribution: { oppref: "opaque+ref/=value" },
};

function baseResolver(overrides: { recentLead?: unknown; leadInsertError?: string } = {}): Resolver {
  return (table, ops) => {
    if (table === "services" || table === "job_types") return { data: { id: `${table}-id` }, error: null };
    if (table === "customers" && has(ops, "insert")) return { data: { id: "customer-new" }, error: null };
    if (table === "customers") return { data: [], error: null };
    if (table === "leads" && has(ops, "insert")) {
      return overrides.leadInsertError
        ? { data: null, error: { message: overrides.leadInsertError } }
        : { data: { id: "lead-created" }, error: null };
    }
    if (table === "leads" && has(ops, "update")) return { data: null, error: null };
    if (table === "leads") return { data: overrides.recentLead ?? null, error: null };
    return { data: null, error: null };
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://empirehomesolutions.co.uk";
  process.env.NEXT_PUBLIC_CALL_NUMBER ??= "01895725151";
  process.env.FORM_WEBHOOK_URL ??= "https://example.invalid/webhook";
  process.env.CONVERSION_API_SECRET ??= "test-secret";
  state.writes = [];
});

describe("website lead → ads conversion ID", () => {
  it("issues an event ID derived from the newly saved CRM lead and records ChatGPT as the source", async () => {
    state.resolver = baseResolver();
    const { submitLeadToWebhook } = await import("@/modules/forms/api/submitLead");
    const { leadMeasurementEventId } = await import("@/modules/tracking/lead-event-id");

    const result = await submitLeadToWebhook(lead);

    expect(result).toEqual({ ok: true, conversionEventId: leadMeasurementEventId(TENANT_ID, "lead-created") });
    const leadInsert = state.writes.find((w) => w.table === "leads" && has(w.ops, "insert"));
    expect((leadInsert!.ops.find((op) => op.method === "insert")!.args[0] as { source: string }).source).toBe("chatgpt");
  });

  it("reuses the existing lead's event ID when the same enquiry is resubmitted", async () => {
    state.resolver = baseResolver({
      recentLead: { id: "lead-existing", status: "new", submission_count: 1, last_submitted_at: new Date().toISOString() },
    });
    const { submitLeadToWebhook } = await import("@/modules/forms/api/submitLead");
    const { leadMeasurementEventId } = await import("@/modules/tracking/lead-event-id");

    const result = await submitLeadToWebhook(lead);

    expect(result).toEqual({ ok: true, conversionEventId: leadMeasurementEventId(TENANT_ID, "lead-existing") });
    expect(state.writes.some((w) => w.table === "leads" && has(w.ops, "insert"))).toBe(false);
  });

  it("issues no event ID when the CRM lead could not be saved", async () => {
    state.resolver = baseResolver({ leadInsertError: "insert failed" });
    const { submitLeadToWebhook } = await import("@/modules/forms/api/submitLead");

    const result = await submitLeadToWebhook(lead);

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("conversionEventId");
  });
});
