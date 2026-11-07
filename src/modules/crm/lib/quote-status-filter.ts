import { quoteStatuses, type QuoteStatus } from "@/modules/crm/types";

// Only a known quote status filters the list; anything else (including the
// "all" tab or a junk value) returns every quote rather than erroring.
export function parseQuoteStatusFilter(value: string | null): QuoteStatus | null {
  return quoteStatuses.includes(value as QuoteStatus) ? (value as QuoteStatus) : null;
}
