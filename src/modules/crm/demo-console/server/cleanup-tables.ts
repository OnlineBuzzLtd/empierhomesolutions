// Cleanup table contract for the Demo Console (ticket E-5).
//
// Each entry MUST be a table that:
//   (a) carries an `is_test boolean` column, AND
//   (b) carries a `tenant_id uuid` column, AND
//   (c) carries a `created_at timestamptz` column.
//
// The cleanup endpoint deletes rows scoped to all three of those plus
// the active session window. Commercial demo tables are listed explicitly
// now that AQD adds is_test to them; this keeps cleanup counts visible and
// prevents quote/invoice rows created by a demo action from accumulating.
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
  "payments",
  "invoices",
  "invoice_schedules",
  "quote_acceptances",
  "quote_versions",
  "quotes",
  "job_survey_assessments",
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
//   - 202606010003_crm_ai_quote_drafting_demo.sql (commercial demo tables)
// Add to this set whenever a future migration extends is_test elsewhere.
export const IS_TEST_BEARING_TABLES: ReadonlySet<string> = new Set([
  "appointments",
  "customers",
  "leads",
  "jobs",
  "payments",
  "invoices",
  "invoice_schedules",
  "quote_acceptances",
  "quote_versions",
  "quotes",
  "job_survey_assessments",
]);

export type CleanupTable = (typeof CLEANUP_TABLES)[number];
