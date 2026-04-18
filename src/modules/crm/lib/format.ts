import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return format(parseISO(value), "dd MMM yyyy");
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return format(parseISO(value), "dd MMM yyyy, HH:mm");
}

/**
 * Combines a date string (YYYY-MM-DD) and a UTC time string (HH:MM:SS)
 * and formats the result in Europe/London local time.
 */
export function formatScheduledTime(date: string | null, time: string | null): string {
  if (!date || !time) return time ?? "Not set";
  const utcIso = `${date}T${time}Z`;
  return new Date(utcIso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
