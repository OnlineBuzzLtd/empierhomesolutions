import { NextResponse } from "next/server";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";

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

type TableCounts = Record<string, number>;

export async function POST() {
  const guard = await guardDemoApi({ requireActiveSession: true });
  if (!guard.ok) return guard.response;

  const { admin, tenantId, activeSession } = guard;
  if (!activeSession) {
    return NextResponse.json({ error: "No active session." }, { status: 409 });
  }

  const sessionStartedAt = activeSession.started_at;
  const deleted: TableCounts = {};

  // Order matters because of FK CASCADE / SET NULL semantics from the
  // crm.customers root. We delete the polymorphic / SET NULL children
  // first so they don't end up orphaned with NULL customer_id, then
  // let CASCADE clean up customer_assets/jobs/quotes/invoices/payments
  // when customers go. notes/attachments/custom_field_values are
  // polymorphic (no FK) and scoped by tenant_id.

  // Helper that runs a delete with the three-fold scope and counts
  // rows returned via PostgREST's return=representation. Surface
  // errors as 502 — partial cleanup is worse than no cleanup.
  async function deleteScoped(table: string, extraFilter?: (qb: ReturnType<typeof admin.schema>) => void): Promise<void> {
    const { data, error } = await admin
      .schema("crm")
      .from(table)
      .delete()
      .eq("tenant_id", tenantId)
      .eq("is_test", true)
      .gte("created_at", sessionStartedAt)
      .select("id");

    if (error) {
      throw new Error(`Cleanup failed on ${table}: ${error.message}`);
    }

    // Use the parameter so eslint stays quiet — we accept the filter
    // function param for future extension (E-5.1 may want to scope
    // notes by entity_type as well).
    void extraFilter;

    deleted[table] = data?.length ?? 0;
  }

  try {
    // appointments / leads have SET NULL FKs to customers — delete them
    // explicitly so they don't linger with NULL customer_id.
    await deleteScoped("appointments");
    await deleteScoped("leads");
    // jobs CASCADE from customers but deleting explicitly first keeps
    // the per-table count visible in the response. Same for
    // customer_assets/quotes/invoices/payments where present.
    await deleteScoped("jobs");
    await deleteScoped("customer_assets");
    await deleteScoped("quotes");
    await deleteScoped("invoices");
    await deleteScoped("payments");
    // Finally the root.
    await deleteScoped("customers");
  } catch (caught) {
    return NextResponse.json(
      {
        error: caught instanceof Error ? caught.message : "Cleanup failed.",
        partial_counts: deleted,
      },
      { status: 502 },
    );
  }

  // Close the session row last so cleanup is idempotent: if the wipe
  // throws midway, the operator can re-invoke cleanup and the same
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
        detail: closeError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    session_id: activeSession.id,
    deleted,
  });
}
