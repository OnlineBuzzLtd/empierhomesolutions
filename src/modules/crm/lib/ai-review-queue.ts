import type { BookingRecoveryCase } from "@/modules/platform/lib/booking-recovery";
import type { PlatformConversationRecord } from "@/modules/platform/lib/repository";
import { getPlatformConversationReviewState } from "@/modules/platform/lib/review";

function isFuture(value: string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

export function summarizeAiReviewQueue(cases: BookingRecoveryCase[]) {
  const conflictCount = cases.filter((item) => Boolean(item.conflictingCustomerId)).length;
  const upcomingBookingCount = cases.filter((item) => isFuture(item.startsAt)).length;
  const missingLinkCount = cases.filter((item) => item.reason.toLowerCase().includes("not linked") || item.appointmentId).length;

  return {
    totalCount: cases.length,
    conflictCount,
    upcomingBookingCount,
    missingLinkCount,
    firstAction:
      conflictCount > 0
        ? "Resolve customer conflicts first"
        : cases.length > 0
          ? "Link booking to customer and job"
          : "No review needed",
  };
}

export function summarizeAiBusinessOutcomes(
  records: PlatformConversationRecord[],
  recoveryCases: BookingRecoveryCase[],
  now = new Date(),
) {
  const todayRecords = records.filter((record) => isSameLocalDay(record.link.latest_event_at, now));
  const reviewableRecords = records.filter((record) => getPlatformConversationReviewState(record).needsReview);
  const bookingsToday = todayRecords.filter((record) => record.bookingAppointment).length;
  const enquiriesToday = todayRecords.filter((record) => record.lead).length;
  const callbacksToday = todayRecords.filter((record) => record.callbackAppointment).length;
  const linkedCustomersToday = todayRecords.filter((record) => record.customer).length;
  const needsReviewCount = reviewableRecords.length + recoveryCases.length;
  const latestActivityAt =
    records
      .map((record) => record.link.latest_event_at)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return {
    conversationsToday: todayRecords.length,
    enquiriesToday,
    bookingsToday,
    callbacksToday,
    linkedCustomersToday,
    needsReviewCount,
    latestActivityAt,
    firstAction:
      recoveryCases.length > 0
        ? "Review unsafe bookings"
        : reviewableRecords.length > 0
          ? "Resolve conversation links"
          : todayRecords.length > 0
            ? "No urgent AI action"
            : "Run a safe test",
  };
}

function isSameLocalDay(value: string | null | undefined, now: Date) {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}
