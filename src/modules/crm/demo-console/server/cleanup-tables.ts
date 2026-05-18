// Cleanup table contract for the Demo Console (ticket E-5).
//
// Each entry MUST be a table that:
//   (a) carries an `is_test boolean` column, AND
//   (b) carries a `tenant_id uuid` column, AND
//   (c) carries a `created_at timestamptz` column.
//
// The cleanup endpoint deletes rows scoped to all three of those plus
// the active session window. Tables that CASCADE from crm.customers
// (customer_assets, quotes, invoices, payments, sites) are NOT in this
// list — they're cleaned implicitly when the customer row is deleted.
//
// This module is the single source of truth for "what cleanup touches".
// A regression in which a table is added here without also adding the
// is_test column would fail the unit test in
// tests/unit/demo-console-cleanup-tables.test.ts, surfaced before deploy.
//
// Background: the customer_assets.is_test column-not-found bug shipped
// on 2026-05-18 because the cleanup endpoint listed customer_assets
// inline and was never unit-tested against the schema. The list is now
// extracted, the test is mandatory, and CLAUDE.md was tightened to
// require tests for DB-referencing API routes.

export const CLEANUP_TABLES = [
  // SET NULL FK to customers — must be explicitly deleted; cascade
  // would only NULL the FK, not delete the row.
  "appointments",
  "leads",
  // CASCADE FK to customers — listed explicitly so the response
  // surfaces a per-table count rather than hiding the deletions inside
  // the customers cascade.
  "jobs",
  // Cascade root.
  "customers",
] as const;

// The set of tables in the CRM schema that have an is_test column.
// Kept in sync with the migrations:
//   - 202605130001_crm_appointments_is_test.sql (appointments)
//   - 202605180001_is_test_on_customers_leads_jobs.sql (customers/leads/jobs)
// Add to this set whenever a future migration extends is_test elsewhere.
export const IS_TEST_BEARING_TABLES: ReadonlySet<string> = new Set([
  "appointments",
  "customers",
  "leads",
  "jobs",
]);

export type CleanupTable = (typeof CLEANUP_TABLES)[number];
