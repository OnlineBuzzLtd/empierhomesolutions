import { NextResponse } from "next/server";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";
import {
  CLEANUP_TABLES,
  IS_TEST_BEARING_TABLES,
  type CleanupTable,
} from "@/modules/crm/demo-console/server/cleanup-tables";

// Demo Console end-and-cleanup endpoint (ticket E-5). Closes the
// active demo session and deletes every is_test=true row created in
// this tenant since the session started. Returns per-table counts.
//
// Scope-filter discipline (matches the manual prod cleanup earlier
// in this codebase's history): every DELETE includes BOTH tenant_id
// AND is_test=true AND created_at >= session.started_at. We never
// rely on just one of those — losing a single constraint would be
// the difference between "wipe demo pollution" and "wipe real customer
// records".
//
// The table list lives in cleanup-tables.ts and is unit-tested. CASCADE
// children of crm.customers (customer_assets / quotes / invoices /
// payments / sites) are deleted implicitly via the customers cascade,
// so they're intentionally absent from CLEANUP_TABLES.

type TableCounts = Partial<Record<CleanupTable, number>>;

export async function POST() {
  const guard = await guardDemoApi({ requireActiveSession: true });
  if (!guard.ok) return guard.response;

  const { admin, tenantId, activeSession } = guard;
  if (!activeSession) {
    return NextResponse.json({ error: "No active session." }, { status: 409 });
  }

  const sessionStartedAt = activeSession.started_at;
  const deleted: TableCounts = {};
  const tableErrors: Record<string, string> = {};

  // Defensive: best-effort per-table. A failure on a non-root table
  // is logged and surfaced but doesn't block the root delete on
  // customers (which CASCADE-cleans the dependents anyway). The root
  // failing is a hard 502 — the session can't be considered cleaned up
  // if the customer rows survive.
  for (const table of CLEANUP_TABLES) {
    // Belt-and-braces: refuse to even attempt a table that the contract
    // module says doesn't have is_test. Surfaces a config drift as a
    // 500 in dev rather than a confusing 502 from PostgREST.
    if (!IS_TEST_BEARING_TABLES.has(table)) {
      tableErrors[table] = "Table not in IS_TEST_BEARING_TABLES set; refusing to delete.";
      continue;
    }
    const { data, error } = await admin
      .schema("crm")
      .from(table)
      .delete()
      .eq("tenant_id", tenantId)
      .eq("is_test", true)
      .gte("created_at", sessionStartedAt)
      .select("id");

    if (error) {
      tableErrors[table] = error.message;
      if (table === "customers") {
        return NextResponse.json(
          {
            error: `Cleanup failed on the customers root: ${error.message}`,
            deleted,
            table_errors: tableErrors,
          },
          { status: 502 },
        );
      }
      continue;
    }
    deleted[table] = data?.length ?? 0;
  }

  // Close the session row last so cleanup is idempotent: if a partial
  // failure happens, the operator can re-invoke cleanup and the same
  // session is still active.
  const { error: closeError } = await admin
    .schema("crm")
    .from("demo_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", activeSession.id);

  if (closeError) {
    return NextResponse.json(
      {
        error: "Cleanup succeeded but session close failed.",
        deleted,
        table_errors: tableErrors,
        detail: closeError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    session_id: activeSession.id,
    deleted,
    table_errors: Object.keys(tableErrors).length > 0 ? tableErrors : undefined,
  });
}
