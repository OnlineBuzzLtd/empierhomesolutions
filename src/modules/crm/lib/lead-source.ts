import { leadSources, type LeadSource } from "@/modules/crm/types";

// Maps free-text "where did they hear about us" into crm.lead_source_t.
//
// Free-text `source` is what the office types; `source_enum` is what reports
// and filters group by. Both leads and customers carry the pair, and the
// customer edit form now lets the office correct the source after creation
// (e.g. "TBC" -> "Leaflet"), so the enum has to be rewritten alongside it or
// reporting silently disagrees with what the record says.
export function toLeadSourceEnum(source: string | null | undefined): LeadSource {
  const normalized = (source ?? "").toLowerCase().trim();
  const option = leadSourceOptions.find((option) => option.label.toLowerCase() === normalized);
  if (option) return option.value;
  if ((leadSources as readonly string[]).includes(normalized)) return normalized as LeadSource;
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("sms")) return "sms";
  if (normalized.includes("email")) return "email";
  if (normalized.includes("google")) return "google_lead";
  if (normalized.includes("meta") || normalized.includes("facebook")) return "meta_lead";
  if (normalized.includes("webchat")) return "webchat";
  if (normalized.includes("form") || normalized.includes("landing")) return "landing_form";
  if (normalized.includes("manual") || normalized.length === 0) return "manual";
  return "other";
}

// Labels for the source picker. Free text remains allowed for anything not
// listed (leaflet drop, word of mouth, van signage) and maps to `other`.
export const leadSourceOptions: ReadonlyArray<{ value: LeadSource; label: string }> = [
  { value: "manual", label: "Phone / walk-in" },
  { value: "landing_form", label: "Website form" },
  { value: "webchat", label: "Website chat" },
  { value: "voice", label: "AI phone call" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "google_lead", label: "Google" },
  { value: "meta_lead", label: "Facebook / Instagram" },
  { value: "other", label: "Other" },
];
