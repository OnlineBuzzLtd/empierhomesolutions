import { z } from "zod";

export const platformCalendarSnapshotVersion = "2026-04-23";

export const platformCalendarResourceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  connectionId: z.string().uuid().nullable(),
  providerType: z.string(),
  resourceRef: z.string(),
  displayName: z.string(),
  metadata: z.record(z.string(), z.any()).default({}),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const platformCalendarWorkingHoursSchema = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(1).max(1440),
  effectiveFrom: z.string().date().nullable(),
  effectiveTo: z.string().date().nullable(),
});

export const platformCalendarTimeOffSchema = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid().nullable(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  allDay: z.boolean(),
  reason: z.string().nullable(),
});

export const platformCalendarHolidaySchema = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid().nullable(),
  // Mixed deployments may briefly return legacy display-formatted holiday
  // strings while the platform control plane rolls forward. We accept any
  // non-empty string here and rely on the platform versioned contract to
  // converge on ISO dates.
  observedOn: z.string().min(1),
  label: z.string(),
});

export const platformCalendarIcsTokenSchema = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  revokedAt: z.string().datetime({ offset: true }).nullable(),
  subscriptionUrl: z.string(),
});

export const platformCalendarBookingSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  leadId: z.string().uuid(),
  resourceId: z.string().uuid(),
  idempotencyKey: z.string(),
  status: z.enum(["hold", "confirmed", "cancelled"]),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  holdExpiresAt: z.string().datetime({ offset: true }).nullable(),
  metadata: z.record(z.string(), z.any()).default({}),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const platformAvailabilitySnapshotSchema = z.object({
  version: z.literal(platformCalendarSnapshotVersion),
  tenantId: z.string().uuid(),
  resources: z.array(platformCalendarResourceSchema),
  workingHours: z.array(platformCalendarWorkingHoursSchema),
  timeOff: z.array(platformCalendarTimeOffSchema),
  holidays: z.array(platformCalendarHolidaySchema),
  icsTokens: z.array(platformCalendarIcsTokenSchema),
});

export const platformScheduleSnapshotSchema = z.object({
  version: z.literal(platformCalendarSnapshotVersion),
  tenantId: z.string().uuid(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  resources: z.array(platformCalendarResourceSchema),
  workingHours: z.array(platformCalendarWorkingHoursSchema),
  timeOff: z.array(platformCalendarTimeOffSchema),
  holidays: z.array(platformCalendarHolidaySchema),
  bookings: z.array(platformCalendarBookingSchema),
});

export type PlatformCalendarResource = z.infer<typeof platformCalendarResourceSchema>;
export type PlatformCalendarWorkingHours = z.infer<typeof platformCalendarWorkingHoursSchema>;
export type PlatformCalendarTimeOff = z.infer<typeof platformCalendarTimeOffSchema>;
export type PlatformCalendarHoliday = z.infer<typeof platformCalendarHolidaySchema>;
export type PlatformCalendarIcsToken = z.infer<typeof platformCalendarIcsTokenSchema>;
export type PlatformCalendarBooking = z.infer<typeof platformCalendarBookingSchema>;
export type PlatformAvailabilitySnapshot = z.infer<typeof platformAvailabilitySnapshotSchema>;
export type PlatformScheduleSnapshot = z.infer<typeof platformScheduleSnapshotSchema>;
