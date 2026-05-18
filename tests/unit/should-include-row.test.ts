import { describe, expect, it } from "vitest";
import { shouldIncludeRow } from "@/modules/crm/demo-console/use-demo-session-feed";

// Pins the live-pane filter behaviour after the 2026-05-18 widening.
// The old filter required is_test=true server-side and missed every
// webchat booking (CJ runtime path doesn't tag is_test). The new
// filter scopes by tenant_id + created_at window only — proven by the
// 2026-05-18 demo screenshot where a booking landed in prod CRM but
// the live pane stayed empty.

const ctx = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  sessionStartIso: "2026-05-18T14:00:00.000Z",
};

describe("shouldIncludeRow", () => {
  it("rejects null / undefined / non-object", () => {
    expect(shouldIncludeRow(null, ctx)).toBe(false);
    expect(shouldIncludeRow(undefined, ctx)).toBe(false);
    expect(shouldIncludeRow("string", ctx)).toBe(false);
    expect(shouldIncludeRow(42, ctx)).toBe(false);
  });

  it("rejects rows for a different tenant", () => {
    const row = {
      tenant_id: "22222222-2222-4222-8222-222222222222",
      created_at: "2026-05-18T14:01:00.000Z",
    };
    expect(shouldIncludeRow(row, ctx)).toBe(false);
  });

  it("rejects rows created before the session started", () => {
    const row = {
      tenant_id: ctx.tenantId,
      created_at: "2026-05-18T13:59:59.999Z",
    };
    expect(shouldIncludeRow(row, ctx)).toBe(false);
  });

  it("rejects rows missing created_at", () => {
    const row = { tenant_id: ctx.tenantId };
    expect(shouldIncludeRow(row, ctx)).toBe(false);
  });

  it("rejects rows whose created_at is not a string", () => {
    const row = { tenant_id: ctx.tenantId, created_at: 1779100000000 };
    expect(shouldIncludeRow(row, ctx)).toBe(false);
  });

  it("ACCEPTS rows in the session window — regardless of is_test (this is the 2026-05-18 fix)", () => {
    const testRow = {
      tenant_id: ctx.tenantId,
      created_at: "2026-05-18T14:01:00.000Z",
      is_test: true,
    };
    const liveRow = {
      tenant_id: ctx.tenantId,
      created_at: "2026-05-18T14:01:00.000Z",
      is_test: false,
    };
    const missingFlag = {
      tenant_id: ctx.tenantId,
      created_at: "2026-05-18T14:01:00.000Z",
    };
    expect(shouldIncludeRow(testRow, ctx)).toBe(true);
    expect(shouldIncludeRow(liveRow, ctx)).toBe(true);
    expect(shouldIncludeRow(missingFlag, ctx)).toBe(true);
  });

  it("accepts a row exactly at the session start instant", () => {
    const row = {
      tenant_id: ctx.tenantId,
      created_at: ctx.sessionStartIso,
    };
    expect(shouldIncludeRow(row, ctx)).toBe(true);
  });

  it("regression — webchat booking from 2026-05-18 screenshot would now be visible", () => {
    // Customer 'zhaz' / source 'ai_webchat' / is_test false / created
    // 14:24:57 — the row that didn't show up in the live pane and
    // prompted this fix.
    const row = {
      id: "c37a548d-0512-4485-b63d-60bbedcfae86",
      tenant_id: ctx.tenantId,
      full_name: "zhaz",
      source: "ai_webchat",
      is_test: false,
      created_at: "2026-05-18T14:24:57.320917+00:00",
    };
    expect(shouldIncludeRow(row, ctx)).toBe(true);
  });
});
