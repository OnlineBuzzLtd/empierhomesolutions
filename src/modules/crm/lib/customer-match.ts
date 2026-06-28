import type { Customer } from "@/modules/crm/types";

export type CustomerMatchInput = {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  postcode?: string | null;
};

export type CustomerMatchCandidate = {
  customer: Customer;
  score: number;
  reasons: string[];
};

function clean(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}

export function normalizeMatchPhone(value: string | null | undefined) {
  return clean(value)?.replace(/[^\d+]/g, "") ?? null;
}

export function normalizeMatchEmail(value: string | null | undefined) {
  return clean(value)?.toLowerCase() ?? null;
}

export function normalizeMatchPostcode(value: string | null | undefined) {
  return clean(value)?.replace(/\s+/g, "").toUpperCase() ?? null;
}

function nameTokens(value: string | null | undefined) {
  return (clean(value)?.toLowerCase().split(/\s+/).filter((token) => token.length >= 3) ?? []).slice(0, 4);
}

export function findCustomerMatchCandidates(
  input: CustomerMatchInput,
  customers: Customer[],
  limit = 4,
): CustomerMatchCandidate[] {
  const phone = normalizeMatchPhone(input.phone);
  const email = normalizeMatchEmail(input.email);
  const postcode = normalizeMatchPostcode(input.postcode);
  const tokens = nameTokens(input.fullName);

  if (!phone && !email && !postcode && tokens.length === 0) {
    return [];
  }

  return customers
    .map((customer) => {
      const reasons: string[] = [];
      let score = 0;
      if (phone && normalizeMatchPhone(customer.phone) === phone) {
        score += 100;
        reasons.push("same phone");
      }
      if (email && normalizeMatchEmail(customer.email) === email) {
        score += 90;
        reasons.push("same email");
      }
      if (postcode && normalizeMatchPostcode(customer.postcode) === postcode) {
        score += 25;
        reasons.push("same postcode");
      }
      const customerName = customer.full_name.toLowerCase();
      const matchedTokens = tokens.filter((token) => customerName.includes(token));
      if (matchedTokens.length > 0) {
        score += matchedTokens.length * 12;
        reasons.push("similar name");
      }
      return { customer, score, reasons };
    })
    .filter((candidate) => candidate.score >= 25)
    .sort((left, right) => right.score - left.score || left.customer.full_name.localeCompare(right.customer.full_name))
    .slice(0, limit);
}
