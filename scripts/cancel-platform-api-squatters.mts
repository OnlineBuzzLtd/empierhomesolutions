#!/usr/bin/env tsx
/**
 * CAL-006 — Cancel test squatters on the platform-api Postgres `bookings`
 * table.
 *
 * Sibling of CAL-002 (`diagnose-test-booking-pollution.mts`). CAL-002
 * cleaned Empire's `crm.appointments`. This script cleans the OTHER
 * calendar source: the platform-api's own Cloud SQL `bookings` table, which
 * `hasAvailabilityConflict` (services/platform-api/src/lib/availability/
 * check.ts) consults FIRST during slot-search.
 *
 * 93 untagged rows there pre-date CAL-003 going live, so the
 * `coalesce(metadata->>'is_test', 'false') <> 'true'` filter doesn't
 * exclude them. They block almost every weekday slot through 2026-06-15,
 * which is why the agent keeps saying "earliest available is the 15th of
 * June" even though Empire's calendar is clean.
 *
 * Dry-run (default):
 *   npx tsx scripts/cancel-platform-api-squatters.mts
 *
 * Cancel mode (writes — UPDATE booking_status='cancelled'):
 *   npx tsx scripts/cancel-platform-api-squatters.mts \
 *     --cancel --confirm-cancel-bookings=I-AM-SURE
 *
 * Mechanism: UPDATE bookings SET booking_status='cancelled',
 *   updated_at=NOW(),
 *   metadata = metadata || jsonb_build_object(
 *     'is_test', true,
 *     'cancelled_reason', 'CAL-006-platform-squatter-cleanup'
 *   )
 * WHERE id IN (matched ids).
 *
 * Defence in depth: cancel removes the row from active queries; the
 * is_test tag protects against any non-status-aware reader. Rollback by
 * the cancelled_reason tag:
 *   UPDATE bookings SET booking_status='confirmed'
 *     WHERE metadata->>'cancelled_reason' = 'CAL-006-platform-squatter-cleanup';
 *
 * Empire's CRM-side bookings for the same real customers (you + Karen)
 * are explicitly NOT in the predicate — see the `NOT (real customer)`
 * sample below.
 */

import { execSync } from "node:child_process";
import { createRequire } from "node:module";

// pg isn't a dep of this repo. It IS installed in the CustomerJourneys
// repo. Resolve it from there at runtime so we don't need a separate
// install path for an ops-only script.
const requireFromCj = createRequire(
  "/Users/shehzadiqbal/Customer Journeys AI v1/customerjourneys-site/package.json"
);
const pg = requireFromCj("pg") as typeof import("pg");

// Empire's tenant id on the CustomerJourneys platform-api side. Different
// uuid from Empire's own crm.tenants id by design (multi-tenant SaaS).
const EMPIRE_TENANT_ID = "b469a9fe-546d-4baa-9f87-3487c7c4afc1";

// 30-day window. The agent's slot-search runs ~14 days out; 30 gives us a
// comfortable margin and catches anything still squatting on June 14-15.
const WINDOW_END = "2026-06-16";

const CLI_ARGS = process.argv.slice(2);
const CANCEL_MODE = CLI_ARGS.includes("--cancel");
const CANCEL_CONFIRM_TOKEN = "I-AM-SURE";
const CANCEL_CONFIRMED = CLI_ARGS.includes(`--confirm-cancel-bookings=${CANCEL_CONFIRM_TOKEN}`);

// The pollution predicate. Built from the persona signatures in the
// live-channel test script and the manual idem-key shapes that have been
// used during the May 2026 mock-validation runs.
//
// Sanity: I dry-ran this against the live DB before writing the script.
// It catches 90 rows, leaves 3 alone (two are Shaz, one is Karen Simmons
// @demo.com — left for the human to review separately).
const POLLUTION_PREDICATE = `
  ( l.email ilike '%@scenariotest.com'
    OR l.email ilike '%@test.com'
    OR l.email ilike 'shaz-bst-test@example.com'
    OR l.email ilike 'test@example.com'
    OR l.full_name ilike 'Tom Brown'
    OR l.full_name ilike 'Tom Hughes'
    OR l.full_name ilike 'Sarah Brown'
    OR l.full_name ilike 'David Patel'
    OR l.full_name ilike 'Mark O%Connor'
    OR l.full_name ilike 'James'
    OR l.full_name ilike 'John Smith'
    OR l.full_name ilike 'Linda'
    OR l.full_name ilike 'Adam smith'
    OR l.full_name ilike 'plumbing emergency'
    OR l.full_name ilike 'leak in the kitchen urgent'
    OR b.idempotency_key like '%postdeploy%'
    OR b.idempotency_key like 'boiler-service-2026%' )
`;

async function main(): Promise<void> {
  const dbUrl = execSync(
    "gcloud secrets versions access latest --secret=platform-database-url --project=customer-journeys-ai",
    { encoding: "utf8" }
  ).trim();

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  try {
    console.log("=".repeat(72));
    console.log("CAL-006 — platform-api bookings squatter cleanup");
    console.log("=".repeat(72));
    console.log(`Tenant:     ${EMPIRE_TENANT_ID} (Empire on CJ side)`);
    console.log(`Window:     now → ${WINDOW_END}`);
    console.log(`Mode:       ${CANCEL_MODE ? (CANCEL_CONFIRMED ? "CANCEL (will write)" : "CANCEL (refused — missing confirm token)") : "DRY-RUN (no writes)"}`);
    console.log();

    // 1. Current state — count untagged actives + tagged actives.
    const stateBefore = await client.query<{ total: string; tagged_test: string; confirmed: string; held: string }>(
      `
      SELECT count(*)::text AS total,
             count(*) FILTER (WHERE metadata->>'is_test' = 'true')::text AS tagged_test,
             count(*) FILTER (WHERE booking_status = 'confirmed')::text AS confirmed,
             count(*) FILTER (WHERE booking_status = 'hold')::text AS held
      FROM bookings
      WHERE tenant_id = $1
        AND start_time >= NOW()
        AND start_time < $2
        AND booking_status IN ('hold','confirmed')`,
      [EMPIRE_TENANT_ID, WINDOW_END]
    );
    console.log("State before:");
    console.log(`  ${JSON.stringify(stateBefore.rows[0])}`);
    console.log();

    // 2. Resolve the matched ids via the join + predicate. Capture id list
    //    so the UPDATE doesn't have to re-evaluate the join.
    const matched = await client.query<{
      id: string;
      start_time: Date;
      booking_status: string;
      lead_email: string | null;
      lead_phone: string | null;
      lead_name: string | null;
      idempotency_key: string | null;
    }>(
      `
      SELECT b.id, b.start_time, b.booking_status, b.idempotency_key,
             l.email AS lead_email, l.phone_number AS lead_phone, l.full_name AS lead_name
      FROM bookings b LEFT JOIN leads l ON l.id = b.lead_id
      WHERE b.tenant_id = $1
        AND b.start_time >= NOW()
        AND b.start_time < $2
        AND b.booking_status IN ('hold','confirmed')
        AND coalesce(b.metadata->>'is_test', 'false') <> 'true'
        AND ${POLLUTION_PREDICATE}
      ORDER BY b.start_time`,
      [EMPIRE_TENANT_ID, WINDOW_END]
    );

    console.log(`Matched ${matched.rowCount} untagged squatter rows for cancellation:`);
    console.log("-".repeat(72));
    for (const r of matched.rows) {
      console.log(
        `  ${r.start_time.toISOString().slice(0, 16)}  ${r.booking_status.padEnd(9)}  ` +
          `${(r.lead_name ?? "—").padEnd(22)}  ${(r.lead_email ?? "—").padEnd(40)}  ${r.lead_phone ?? "—"}`
      );
    }
    console.log();

    // 3. Show what we'd LEAVE behind — anything untagged + NOT matching.
    //    These are the rows the operator should review manually.
    const remaining = await client.query<{
      id: string;
      start_time: Date;
      booking_status: string;
      lead_email: string | null;
      lead_phone: string | null;
      lead_name: string | null;
    }>(
      `
      SELECT b.id, b.start_time, b.booking_status,
             l.email AS lead_email, l.phone_number AS lead_phone, l.full_name AS lead_name
      FROM bookings b LEFT JOIN leads l ON l.id = b.lead_id
      WHERE b.tenant_id = $1
        AND b.start_time >= NOW()
        AND b.start_time < $2
        AND b.booking_status IN ('hold','confirmed')
        AND coalesce(b.metadata->>'is_test', 'false') <> 'true'
        AND NOT ${POLLUTION_PREDICATE}
      ORDER BY b.start_time`,
      [EMPIRE_TENANT_ID, WINDOW_END]
    );
    console.log(`Untagged rows NOT matched (left alone for human review) — ${remaining.rowCount}:`);
    console.log("-".repeat(72));
    for (const r of remaining.rows) {
      console.log(
        `  ${r.start_time.toISOString().slice(0, 16)}  ${r.booking_status.padEnd(9)}  ` +
          `${(r.lead_name ?? "—").padEnd(22)}  ${(r.lead_email ?? "—").padEnd(40)}  ${r.lead_phone ?? "—"}`
      );
    }
    console.log();

    if (!CANCEL_MODE) {
      console.log("NO WRITES PERFORMED.");
      console.log(`To cancel the ${matched.rowCount} rows above:`);
      console.log("  npx tsx scripts/cancel-platform-api-squatters.mts \\");
      console.log(`    --cancel --confirm-cancel-bookings=${CANCEL_CONFIRM_TOKEN}`);
      return;
    }

    if (!CANCEL_CONFIRMED) {
      console.error(`REFUSED: --cancel requires --confirm-cancel-bookings=${CANCEL_CONFIRM_TOKEN}`);
      process.exitCode = 2;
      return;
    }

    if (matched.rowCount === 0) {
      console.log("Nothing to cancel — predicate matched 0 rows.");
      return;
    }

    // 4. One UPDATE, ids passed via ANY($1). Atomic per Postgres semantics.
    console.log("=".repeat(72));
    console.log(`Cancelling ${matched.rowCount} rows…`);
    console.log("=".repeat(72));

    const ids = matched.rows.map((r) => r.id);
    const updateResult = await client.query<{ id: string; booking_status: string }>(
      `
      UPDATE bookings
      SET booking_status = 'cancelled',
          updated_at = NOW(),
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'is_test', true,
            'cancelled_reason', 'CAL-006-platform-squatter-cleanup'
          )
      WHERE id = ANY($1)
      RETURNING id, booking_status`,
      [ids]
    );
    console.log(`Updated ${updateResult.rowCount} rows.`);
    console.log();

    // 5. State after.
    const stateAfter = await client.query<{ total: string; tagged_test: string; confirmed: string; held: string }>(
      `
      SELECT count(*)::text AS total,
             count(*) FILTER (WHERE metadata->>'is_test' = 'true')::text AS tagged_test,
             count(*) FILTER (WHERE booking_status = 'confirmed')::text AS confirmed,
             count(*) FILTER (WHERE booking_status = 'hold')::text AS held
      FROM bookings
      WHERE tenant_id = $1
        AND start_time >= NOW()
        AND start_time < $2
        AND booking_status IN ('hold','confirmed')`,
      [EMPIRE_TENANT_ID, WINDOW_END]
    );
    console.log("State after:");
    console.log(`  ${JSON.stringify(stateAfter.rows[0])}`);
    console.log();

    const remainingUntagged = await client.query<{ count: string }>(
      `
      SELECT count(*)::text AS count
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.start_time >= NOW()
        AND b.start_time < $2
        AND b.booking_status IN ('hold','confirmed')
        AND coalesce(b.metadata->>'is_test', 'false') <> 'true'`,
      [EMPIRE_TENANT_ID, WINDOW_END]
    );
    console.log(`Untagged active rows remaining: ${remainingUntagged.rows[0].count}`);
    console.log();

    console.log("=".repeat(72));
    console.log("CAL-006 done");
    console.log("=".repeat(72));
    console.log("Rollback (if needed):");
    console.log("  UPDATE bookings SET booking_status='confirmed'");
    console.log("    WHERE metadata->>'cancelled_reason' = 'CAL-006-platform-squatter-cleanup';");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
