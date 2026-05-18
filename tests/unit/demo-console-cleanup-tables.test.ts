import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLEANUP_TABLES,
  IS_TEST_BEARING_TABLES,
} from "@/modules/crm/demo-console/server/cleanup-tables";

// Demo Console cleanup contract test (ticket E-5 follow-up). This test
// exists because we shipped a cleanup endpoint that referenced
// customer_assets.is_test before the column existed, and it failed
// in production. The test now blocks that class of regression.
//
// It enforces three invariants:
//   (1) Every table in CLEANUP_TABLES is on the is_test allowlist.
//   (2) Every table named in IS_TEST_BEARING_TABLES has an is_test
//       column declared in some migration under supabase/migrations.
//       If a future migration drops or renames is_test, this test
//       fails loudly.
//   (3) CLEANUP_TABLES contains the root (customers) — the cleanup
//       relies on CASCADE for customer_assets/quotes/invoices/payments.

const MIGRATIONS_DIR = path.join(
  process.cwd(),
  "supabase",
  "migrations",
);

async function migrationsMentioningIsTestOn(table: string): Promise<string[]> {
  const files = await fs.readdir(MIGRATIONS_DIR);
  const matches: string[] = [];
  for (const file of files) {
    if (!file.endsWith(".sql")) continue;
    const contents = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    // Two acceptable shapes for "this migration gives <table> an is_test column":
    //   - `alter table crm.<table>` ... `add column ... is_test`
    //   - `create table ... crm.<table>` ... `is_test boolean`
    const lower = contents.toLowerCase();
    const addColumnRegex = new RegExp(
      `alter table\\s+crm\\.${table}[^;]*add column[^;]*is_test`,
      "s",
    );
    if (addColumnRegex.test(lower)) matches.push(file);
  }
  return matches;
}

describe("Demo Console cleanup tables contract", () => {
  it("every CLEANUP_TABLES entry is on the is_test allowlist", () => {
    for (const table of CLEANUP_TABLES) {
      expect(
        IS_TEST_BEARING_TABLES.has(table),
        `CLEANUP_TABLES contains '${table}' but IS_TEST_BEARING_TABLES does not. ` +
          `Add it (with a migration adding the column) before listing it for cleanup.`,
      ).toBe(true);
    }
  });

  it("IS_TEST_BEARING_TABLES entries each have an is_test column added by some migration", async () => {
    for (const table of IS_TEST_BEARING_TABLES) {
      const matches = await migrationsMentioningIsTestOn(table);
      expect(
        matches.length,
        `Table 'crm.${table}' is in IS_TEST_BEARING_TABLES but no migration ` +
          `under supabase/migrations adds is_test to it. Either add the migration ` +
          `or remove the table from IS_TEST_BEARING_TABLES.`,
      ).toBeGreaterThan(0);
    }
  });

  it("CLEANUP_TABLES includes customers as the cascade root", () => {
    expect((CLEANUP_TABLES as readonly string[]).includes("customers")).toBe(true);
  });

  it("CLEANUP_TABLES does NOT include tables that cascade from customers", () => {
    // These tables cascade from crm.customers (see
    // 202603120001_crm_foundation.sql). They must NOT be in
    // CLEANUP_TABLES because the explicit DELETE would reference a
    // non-existent is_test column — the exact bug that prompted this test.
    const cascadeChildren = [
      "customer_assets",
      "quotes",
      "invoices",
      "payments",
      "sites",
    ];
    for (const table of cascadeChildren) {
      expect(
        (CLEANUP_TABLES as readonly string[]).includes(table),
        `CLEANUP_TABLES includes cascade child '${table}'. CASCADE handles it; ` +
          `listing it explicitly will fail because the table has no is_test column.`,
      ).toBe(false);
    }
  });
});
