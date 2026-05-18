// Pure placeholder substitution used by the captured-payload replay
// (ticket E-3). Extracted from replay-fixture.ts so the substitution
// logic can be unit-tested without touching disk or the network — the
// loading + posting code stays imperative; this function stays pure.
//
// Supported placeholders (string-replace, all occurrences):
//   {{prospect_name}}         — the consented prospect's full name
//   {{prospect_phone}}        — the consented prospect's phone (E.164)
//   {{prospect_phone_digits}} — digits-only form (no +, no spaces, no
//                                punctuation). Useful for email locals
//                                or external_id values.

export type PlaceholderContext = {
  prospect_name: string;
  prospect_phone: string;
};

export function substitutePlaceholders(
  value: unknown,
  context: PlaceholderContext,
): unknown {
  if (typeof value === "string") {
    return value
      .replaceAll("{{prospect_name}}", context.prospect_name)
      .replaceAll("{{prospect_phone}}", context.prospect_phone)
      .replaceAll(
        "{{prospect_phone_digits}}",
        context.prospect_phone.replace(/[^\d]/g, ""),
      );
  }
  if (Array.isArray(value)) {
    return value.map((item) => substitutePlaceholders(item, context));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = substitutePlaceholders(child, context);
    }
    return out;
  }
  return value;
}
