// Customer marketing-list CSV export.
//
// Kept separate from the route so the row selection and the CSV encoding can be
// tested without a Supabase client. The route owns auth and streaming; this
// module owns "what goes in the file and how it is escaped".

export type CustomerExportRow = {
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

export const customerExportColumns = ["Name", "Phone", "Email"] as const;

// Columns selected from crm.customers. Kept as an exported constant so a test
// can assert the route asks for exactly the fields it writes — the Demo Console
// `customer_assets.is_test` incident (2026-05-18) shipped because a query
// referenced a column nothing verified existed.
export const customerExportSelect = "full_name, phone, email";

// Page size for the chunked read. The export must not issue one unbounded
// select — a tenant with tens of thousands of customers would blow the response
// timeout and the Supabase row cap alike.
export const customerExportPageSize = 1000;

// Spreadsheets treat a leading =, +, - or @ as the start of a formula, so a
// value like "=cmd|..." pasted from a web form becomes executable on open.
// Prefix with an apostrophe to force text. See OWASP "CSV injection".
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvValue(value: string | null | undefined) {
  const raw = value == null ? "" : String(value);
  const guarded = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  // RFC 4180: quote when the value contains a delimiter, quote or newline, and
  // escape embedded quotes by doubling them.
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replaceAll('"', '""')}"`;
  }
  return guarded;
}

export function toCsvLine(values: ReadonlyArray<string | null | undefined>) {
  return `${values.map(escapeCsvValue).join(",")}\r\n`;
}

export function customerExportHeader() {
  return toCsvLine(customerExportColumns);
}

export function customerExportLine(row: CustomerExportRow) {
  return toCsvLine([row.full_name, row.phone, row.email]);
}

export function customerExportFilename(tenantSlug: string | null | undefined, now: Date) {
  const slug = (tenantSlug ?? "customers").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `${slug}-customers-${now.toISOString().slice(0, 10)}.csv`;
}
