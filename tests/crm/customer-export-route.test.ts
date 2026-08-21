import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  customerExportFilename,
  customerExportHeader,
  customerExportLine,
  customerExportPageSize,
  customerExportSelect,
  escapeCsvValue,
} from "@/modules/crm/lib/customer-export";

// Cover for GET /api/crm/customers/export — the marketing-list download.
//
// Two things matter and both are asserted here: the row filter (this list gets
// used for real sends, so an archived / deleted / test row leaking into it is a
// customer-facing problem), and the CSV encoding (names contain commas and
// apostrophes, and spreadsheets execute values starting with = + - @).

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const TENANT = { id: "11111111-1111-4111-8111-111111111111", slug: "empire-home-solutions" };

type Filters = Record<string, unknown>;

async function callExport(opts: { pages: Array<Array<Record<string, unknown>>>; role?: "management" | "sales" }) {
  const filters: Filters = {};
  const ranges: Array<[number, number]> = [];
  let selectArg = "";
  let page = 0;

  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: (columns: string) => {
      selectArg = columns;
      return chain();
    },
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return chain();
    },
    is: (column: string, value: unknown) => {
      filters[column] = value;
      return chain();
    },
    order: () => chain(),
    range: (from: number, to: number) => {
      ranges.push([from, to]);
      const rows = opts.pages[page] ?? [];
      page += 1;
      return Promise.resolve({ data: rows, error: null });
    },
  });

  const supabase = { schema: () => ({ from: () => builder }) };

  if (opts.role === "sales") {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        error: jsonError("You do not have access to this CRM action.", 403),
      }),
    }));
  } else {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { supabase, tenant: TENANT } }),
    }));
  }

  const route = await import("@/app/api/crm/customers/export/route");
  const response = (await route.GET()) as Response;
  const text = response.body ? await new Response(response.body).text() : "";

  return { response, text, filters, ranges, selectArg };
}

describe("GET /api/crm/customers/export", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a CSV attachment with a header row", async () => {
    const { response, text } = await callExport({
      pages: [[{ full_name: "Jackie White", phone: "07700 900111", email: "jackie@example.com" }]],
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(text).toBe(
      "Name,Phone,Email\r\nJackie White,07700 900111,jackie@example.com\r\n",
    );
  });

  it("excludes archived, deleted, test and demo rows and scopes to the tenant", async () => {
    const { filters, selectArg } = await callExport({ pages: [[]] });

    expect(filters).toMatchObject({
      tenant_id: TENANT.id,
      archived: false,
      is_test: false,
      is_demo: false,
      record_deleted_at: null,
    });
    // Guards against selecting a column the CSV writer doesn't emit, or vice
    // versa.
    expect(selectArg).toBe(customerExportSelect);
  });

  it("pages through large tenants rather than issuing one unbounded select", async () => {
    const fullPage = Array.from({ length: customerExportPageSize }, (_, i) => ({
      full_name: `Customer ${i}`,
      phone: null,
      email: null,
    }));
    const { ranges, text } = await callExport({ pages: [fullPage, [{ full_name: "Last", phone: null, email: null }]] });

    expect(ranges).toEqual([
      [0, customerExportPageSize - 1],
      [customerExportPageSize, customerExportPageSize * 2 - 1],
    ]);
    expect(text.trimEnd().split("\r\n")).toHaveLength(customerExportPageSize + 2); // header + rows
    expect(text).toContain("Last");
  });

  it("refuses a non-manager", async () => {
    const { response } = await callExport({ pages: [[]], role: "sales" });

    expect(response.status).toBe(403);
  });
});

describe("customer export CSV encoding", () => {
  it("quotes values containing commas, quotes or newlines", () => {
    expect(escapeCsvValue("White, Jackie")).toBe('"White, Jackie"');
    expect(escapeCsvValue('Jackie "JW" White')).toBe('"Jackie ""JW"" White"');
    expect(escapeCsvValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("leaves ordinary values untouched", () => {
    expect(escapeCsvValue("Jackie White")).toBe("Jackie White");
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("neutralises spreadsheet formula injection", () => {
    // A name field is free text from a web form; without this a stored
    // "=HYPERLINK(...)" would execute when the marketing list is opened.
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("+44 7700 900111")).toBe("'+44 7700 900111");
    expect(escapeCsvValue("-lead")).toBe("'-lead");
    expect(escapeCsvValue("@handle")).toBe("'@handle");
  });

  it("round-trips a row with a comma in the name", () => {
    expect(customerExportLine({ full_name: "White, Jackie", phone: "07700 900111", email: null })).toBe(
      '"White, Jackie",07700 900111,\r\n',
    );
  });

  it("names the file after the tenant and the date", () => {
    expect(customerExportFilename("empire-home-solutions", new Date("2026-08-19T09:00:00Z"))).toBe(
      "empire-home-solutions-customers-2026-08-19.csv",
    );
    expect(customerExportFilename(null, new Date("2026-08-19T09:00:00Z"))).toBe(
      "customers-customers-2026-08-19.csv",
    );
  });

  it("emits the documented column order", () => {
    expect(customerExportHeader()).toBe("Name,Phone,Email\r\n");
  });
});
