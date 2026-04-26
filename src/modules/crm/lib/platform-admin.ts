import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { getCrmSession } from "@/modules/crm/lib/auth";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

// Platform-admin gate.
//
// Callers that touch multi-tenant lifecycle (suspend, resume, export, hard
// delete) MUST be platform_admins. Until the apps/console is live we accept
// two signals:
//
// 1. An explicit `PLATFORM_ADMIN_EMAILS` allowlist (comma-separated). This
//    is the ops-friendly way to bootstrap access before an RBAC table is
//    generalised in the console.
// 2. An `X-Platform-Admin-Token` header for CLI / reaper jobs, backed by
//    `PLATFORM_ADMIN_API_TOKEN` (optional).
//
// Both paths are deliberately server-only and never leak into client code.

function normalise(value: string | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => normalise(email))
      .filter((email) => email.length > 0),
  );
}

function adminApiToken(): string | null {
  const raw = process.env.PLATFORM_ADMIN_API_TOKEN;
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  return raw.trim();
}

export function isPlatformAdminUser(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }
  const email = normalise(user.email);
  if (!email) {
    return false;
  }
  return adminEmails().has(email);
}

export type PlatformAdminCaller =
  | { kind: "user"; email: string; userId: string }
  | { kind: "service"; label: string };

function tokenMatches(header: string | null, expected: string): boolean {
  if (!header) {
    return false;
  }
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  // timingSafeEqual is available via crypto in node; fall back to manual.
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

export async function requirePlatformAdmin(
  request: Request,
): Promise<{ ok: true; caller: PlatformAdminCaller } | { ok: false; response: NextResponse }> {
  const token = adminApiToken();
  const tokenHeader = request.headers.get("x-platform-admin-token");
  if (token && tokenHeader && tokenMatches(tokenHeader, token)) {
    return {
      ok: true,
      caller: {
        kind: "service",
        label: request.headers.get("x-platform-admin-label")?.slice(0, 64) ?? "service",
      },
    };
  }

  const session = await getCrmSession();
  if (!session.user || !isPlatformAdminUser(session.user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "not_authorised" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    caller: {
      kind: "user",
      email: (session.user.email ?? "").toLowerCase(),
      userId: session.user.id,
    },
  };
}

export async function recordTenantLifecycleEvent(input: {
  tenantId: string;
  action: "suspend" | "resume" | "soft_delete" | "hard_delete" | "export";
  caller: PlatformAdminCaller;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  let admin: ReturnType<typeof createCrmServiceRoleClient> | null = null;
  try {
    admin = createCrmServiceRoleClient();
  } catch {
    return;
  }
  if (!admin) {
    return;
  }
  const actor =
    input.caller.kind === "user" ? `user:${input.caller.email}` : `service:${input.caller.label}`;
  await admin
    .schema("crm")
    .from("tenant_lifecycle_events")
    .insert({
      tenant_id: input.tenantId,
      action: input.action,
      actor,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
    });
}
