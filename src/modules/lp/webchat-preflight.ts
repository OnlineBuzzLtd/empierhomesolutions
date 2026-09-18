import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\s()-]+$/, "Enter a valid UK mobile number.")
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .refine((value) => /^(?:\+447\d{9}|07\d{9})$/.test(value), "Enter a valid UK mobile number.")
  .transform((value) => value.startsWith("07") ? `+44${value.slice(1)}` : value);

export const webchatPreflightSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  openingMessage: z
    .string()
    .trim()
    .min(2, "Tell us briefly how we can help.")
    .max(2000, "Your message is too long."),
});

export type WebchatPreflightInput = z.input<typeof webchatPreflightSchema>;
export type WebchatPreflightContact = z.output<typeof webchatPreflightSchema>;
