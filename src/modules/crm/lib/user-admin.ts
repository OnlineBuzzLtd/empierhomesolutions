import { randomBytes } from "node:crypto";
import { z } from "zod";

import { optionalPasswordSchema } from "@/modules/crm/lib/password-validation";
import { crmRoles, type CrmRole } from "@/modules/crm/types";

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine((value) => value == null || value.length <= max, {
      message: `Must be at most ${max} characters.`,
    });

export const createUserSchema = z.object({
  email: z.string().email("A valid email address is required."),
  full_name: z.string().min(1, "Full name is required.").max(120),
  role: z.enum(crmRoles).default("engineer"),
  phone: optionalText(60),
  password: optionalPasswordSchema,
  agreed_hours: optionalText(120),
  pay_type: optionalText(60),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Accepts the raw boolean used by JSON clients and the "true"/"false"
// strings that the ApiForm helper posts for hidden inputs.
export const updateUserStatusSchema = z.object({
  active: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => (typeof value === "boolean" ? value : value === "true")),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

// 18 random bytes -> 24-char base64url (~144 bits of entropy). The route
// only ever returns this once in the create response; we never persist it.
export function generateUserPassword() {
  return randomBytes(18).toString("base64url");
}

export type CreatedUserProfilePayload = {
  tenant_id: string;
  user_id: string;
  role: CrmRole;
  full_name: string;
  phone: string | null;
  email: string;
  agreed_hours: string | null;
  pay_type: string | null;
  active: boolean;
};

export function buildCreatedUserProfilePayload(input: {
  tenantId: string;
  userId: string;
  data: CreateUserInput;
  normalizedEmail: string;
}): CreatedUserProfilePayload {
  return {
    tenant_id: input.tenantId,
    user_id: input.userId,
    role: input.data.role,
    full_name: input.data.full_name.trim(),
    phone: input.data.phone,
    email: input.normalizedEmail,
    agreed_hours: input.data.agreed_hours,
    pay_type: input.data.pay_type,
    active: true,
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
