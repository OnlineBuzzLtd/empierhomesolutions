import { describe, expect, it } from "vitest";
import {
  buildCreatedUserProfilePayload,
  createUserSchema,
  generateUserPassword,
  getManagedUserPasswordError,
  isShortcutEngineerPassword,
  normalizeEmail,
  updateUserStatusSchema,
} from "@/modules/crm/lib/user-admin";
import { changeOwnPasswordSchema, resetUserPasswordSchema } from "@/modules/crm/lib/password-validation";

// Contract tests for the user-admin Zod schemas + helpers.
//
// Why: this code creates real auth.users rows with passwords and toggles
// tenant_memberships.active. A regression in validation (e.g. accepting
// a 3-char password, or coercing "no" -> true on the deactivate flag)
// is the exact failure shape that produced past Twilio + cleanup
// incidents — small validation drift, big production blast radius.
// Test the boundary cases rather than relying on integration-only coverage.

describe("createUserSchema", () => {
  it("accepts the minimum viable engineer payload (auto-generated password)", () => {
    const parsed = createUserSchema.safeParse({
      email: "Shane@EmpireHomeSolutions.local",
      full_name: "  Shane  ",
      role: "engineer",
      phone: "  07740 017130  ",
      password: "",
      agreed_hours: "",
      pay_type: "",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.password).toBeUndefined();
    expect(parsed.data.phone).toBe("07740 017130");
    expect(parsed.data.agreed_hours).toBeNull();
    expect(parsed.data.pay_type).toBeNull();
    // Email casing is normalized by the route (not the schema); confirm
    // schema preserves the raw value so route can run normalizeEmail.
    expect(parsed.data.email).toBe("Shane@EmpireHomeSolutions.local");
  });

  it("rejects a missing or invalid email", () => {
    expect(createUserSchema.safeParse({ full_name: "X" }).success).toBe(false);
    expect(createUserSchema.safeParse({ email: "not-an-email", full_name: "X" }).success).toBe(false);
  });

  it("rejects a missing or blank full_name", () => {
    expect(createUserSchema.safeParse({ email: "x@y.com" }).success).toBe(false);
    expect(createUserSchema.safeParse({ email: "x@y.com", full_name: "" }).success).toBe(false);
  });

  it("defaults role to 'engineer' when omitted", () => {
    const parsed = createUserSchema.safeParse({ email: "x@y.com", full_name: "X" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.role).toBe("engineer");
  });

  it("rejects an unknown role", () => {
    expect(createUserSchema.safeParse({ email: "x@y.com", full_name: "X", role: "ceo" }).success).toBe(false);
  });

  it("rejects a password shorter than 12 characters", () => {
    const parsed = createUserSchema.safeParse({
      email: "x@y.com",
      full_name: "X",
      password: "short",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/12 characters/);
    }
  });

  it("accepts the local engineer shortcut password for @ehs.local accounts", () => {
    const parsed = createUserSchema.safeParse({
      email: "shane@ehs.local",
      full_name: "Shane",
      role: "engineer",
      password: "password",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.password).toBe("password");
  });

  it("rejects the shortcut password outside local engineer shortcut accounts", () => {
    expect(
      createUserSchema.safeParse({
        email: "shane@example.com",
        full_name: "Shane",
        role: "engineer",
        password: "password",
      }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({
        email: "manager@ehs.local",
        full_name: "Manager",
        role: "management",
        password: "password",
      }).success,
    ).toBe(false);
  });

  it("accepts an explicit password >= 12 characters", () => {
    const parsed = createUserSchema.safeParse({
      email: "x@y.com",
      full_name: "X",
      password: "longenough-12!",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.password).toBe("longenough-12!");
  });

  it("treats empty/whitespace optional strings as null", () => {
    const parsed = createUserSchema.safeParse({
      email: "x@y.com",
      full_name: "X",
      phone: "   ",
      agreed_hours: "",
      pay_type: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.phone).toBeNull();
    expect(parsed.data.agreed_hours).toBeNull();
    expect(parsed.data.pay_type).toBeNull();
  });
});

describe("updateUserStatusSchema", () => {
  it("accepts raw booleans (JSON callers)", () => {
    expect(updateUserStatusSchema.parse({ active: true }).active).toBe(true);
    expect(updateUserStatusSchema.parse({ active: false }).active).toBe(false);
  });

  it("accepts the literal 'true' / 'false' strings the ApiForm sends", () => {
    expect(updateUserStatusSchema.parse({ active: "true" }).active).toBe(true);
    expect(updateUserStatusSchema.parse({ active: "false" }).active).toBe(false);
  });

  it("rejects any other string (defensive against silent truthy coercion)", () => {
    // This is the exact bug class — naive coerce.boolean() would turn
    // "no" into `true`. Schema must reject anything outside the allow-list.
    for (const value of ["no", "yes", "0", "1", "TRUE", "False", " true ", ""]) {
      const parsed = updateUserStatusSchema.safeParse({ active: value });
      expect(parsed.success, `schema must reject active=${JSON.stringify(value)}`).toBe(false);
    }
  });

  it("rejects missing or non-boolean payloads", () => {
    expect(updateUserStatusSchema.safeParse({}).success).toBe(false);
    expect(updateUserStatusSchema.safeParse({ active: 1 }).success).toBe(false);
    expect(updateUserStatusSchema.safeParse({ active: null }).success).toBe(false);
  });
});

describe("changeOwnPasswordSchema", () => {
  it("accepts a valid current/new password payload", () => {
    const parsed = changeOwnPasswordSchema.safeParse({
      current_password: "current-pass",
      new_password: "new-password-123",
      confirm_password: "new-password-123",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires the current password", () => {
    const parsed = changeOwnPasswordSchema.safeParse({
      current_password: "",
      new_password: "new-password-123",
      confirm_password: "new-password-123",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/Current password/);
    }
  });

  it("rejects mismatched confirmation", () => {
    const parsed = changeOwnPasswordSchema.safeParse({
      current_password: "current-pass",
      new_password: "new-password-123",
      confirm_password: "different-pass-123",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/match/);
    }
  });
});

describe("resetUserPasswordSchema", () => {
  it("treats a blank password as generate-one-time-password", () => {
    const parsed = resetUserPasswordSchema.safeParse({
      user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      password: "   ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.password).toBeUndefined();
  });

  it("accepts a typed password >= 12 characters", () => {
    const parsed = resetUserPasswordSchema.safeParse({
      user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      password: "new-password-123",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid user ids but leaves password strength to contextual route validation", () => {
    expect(resetUserPasswordSchema.safeParse({ user_id: "not-a-uuid", password: "" }).success).toBe(false);
    const parsed = resetUserPasswordSchema.safeParse({
      user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      password: "short",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.password).toBe("short");
  });
});

describe("managed user password shortcut policy", () => {
  it("recognizes only the exact local engineer shortcut", () => {
    expect(
      isShortcutEngineerPassword({ email: "SHANE@EHS.LOCAL", role: "engineer", password: "password" }),
    ).toBe(true);
    expect(
      isShortcutEngineerPassword({ email: "shane@ehs.local", role: "engineer", password: "Password" }),
    ).toBe(false);
    expect(
      isShortcutEngineerPassword({ email: "shane@example.com", role: "engineer", password: "password" }),
    ).toBe(false);
    expect(
      isShortcutEngineerPassword({ email: "admin@ehs.local", role: "admin", password: "password" }),
    ).toBe(false);
  });

  it("keeps the 12-character rule for normal managed users", () => {
    expect(
      getManagedUserPasswordError({
        email: "admin@ehs.local",
        role: "admin",
        password: "password",
      }),
    ).toMatch(/12 characters/);
    expect(
      getManagedUserPasswordError({
        email: "admin@ehs.local",
        role: "admin",
        password: "longenough-12!",
      }),
    ).toBeNull();
  });
});

describe("generateUserPassword", () => {
  it("returns >= 16 characters of url-safe entropy", () => {
    const pw = generateUserPassword();
    expect(pw.length).toBeGreaterThanOrEqual(16);
    expect(pw).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a different string each call (sanity)", () => {
    const a = generateUserPassword();
    const b = generateUserPassword();
    expect(a).not.toBe(b);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Shane@EMPIRE.local  ")).toBe("shane@empire.local");
  });
});

describe("buildCreatedUserProfilePayload", () => {
  it("assembles the row the route inserts into crm.user_profiles", () => {
    const parsed = createUserSchema.parse({
      email: "Shane@empire.local",
      full_name: "  Shane  ",
      phone: "07740017130",
      role: "engineer",
    });
    const payload = buildCreatedUserProfilePayload({
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      normalizedEmail: normalizeEmail(parsed.email),
      data: parsed,
    });
    expect(payload).toEqual({
      tenant_id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      role: "engineer",
      full_name: "Shane",
      phone: "07740017130",
      email: "shane@empire.local",
      agreed_hours: null,
      pay_type: null,
      active: true,
    });
  });

  it("never persists email in mixed case (downstream lookups are case-sensitive)", () => {
    const parsed = createUserSchema.parse({ email: "X@Y.com", full_name: "Y" });
    const payload = buildCreatedUserProfilePayload({
      tenantId: "t",
      userId: "u",
      normalizedEmail: normalizeEmail(parsed.email),
      data: parsed,
    });
    expect(payload.email).toBe("x@y.com");
  });

  it("always marks the new profile as active (UI relies on this for engineer dropdown)", () => {
    const parsed = createUserSchema.parse({ email: "x@y.com", full_name: "Y" });
    const payload = buildCreatedUserProfilePayload({
      tenantId: "t",
      userId: "u",
      normalizedEmail: "x@y.com",
      data: parsed,
    });
    expect(payload.active).toBe(true);
  });
});
