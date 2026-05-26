import { z } from "zod";

export const crmPasswordMinLength = 12;

export const passwordValueSchema = z
  .string()
  .min(crmPasswordMinLength, `Password must be at least ${crmPasswordMinLength} characters.`);

export const optionalRawPasswordSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value == null || value.trim() === "" ? undefined : value));

export const optionalPasswordSchema = optionalRawPasswordSchema.refine(
  (value) => value === undefined || value.length >= crmPasswordMinLength,
  {
    message: `Password must be at least ${crmPasswordMinLength} characters.`,
  },
);

export const changeOwnPasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required."),
    new_password: passwordValueSchema,
    confirm_password: z.string().min(1, "Confirm password is required."),
  })
  .refine((value) => value.new_password === value.confirm_password, {
    path: ["confirm_password"],
    message: "New passwords must match.",
  });

export const resetUserPasswordSchema = z.object({
  user_id: z.string().uuid("A valid user id is required."),
  password: optionalRawPasswordSchema,
});
