export function formatPlatformTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function humanizePlatformKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getPlatformStatusBadgeClass(status: string) {
  switch (status) {
    case "processed":
    case "acked":
      return "bg-emerald-100 text-emerald-700";
    case "accepted":
    case "sent":
      return "bg-sky-100 text-sky-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "ignored":
    case "dead_letter":
      return "bg-slate-200 text-slate-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
