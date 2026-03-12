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
