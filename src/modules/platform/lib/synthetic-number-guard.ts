// Synthetic-number guard for /api/platform/events.
//
// Background: the May 12 and May 14 2026 Twilio incidents were caused by
// automated test runs firing real Twilio SMS to synthetic UK-format numbers.
// The numbers passed E.164 syntax validation and reached Twilio, where they
// bounced (errors 21211 / 30453). Carriers treat the resulting pattern of
// repeated undeliverables from a single sender as a spam signal — the May 14
// incident pushed Empire's sender health to 52/100 (Poor) and it has not
// recovered.
//
// This guard sits at the /api/platform/events HTTP boundary and refuses
// payloads whose phone fields match the historical synthetic patterns,
// unless the number is on the DEMO_CONSOLE_ALLOWLIST. Twilio Magic Numbers
// (+15005550006 family) are always allowed because they are the documented
// way to exercise the integration without firing real outbound.

const TWILIO_MAGIC_NUMBER_PREFIX = "+150055500";

// Prefixes that prior synthetic test runs used. Adding to this list is the
// safest place to react to a new bad pattern — the route blocks any number
// whose E.164 form starts with one of these.
const KNOWN_SYNTHETIC_PREFIXES: ReadonlyArray<string> = [
  "+447463366", // CAL-003 / May 12-13 sequential booking tests (+447463366301..310)
];

// Historical Empire sender numbers. A destination matching the sender is the
// fingerprint of a misconfigured test loop (we saw +447401248976 in the
// Twilio Insights screenshot). Worth blocking explicitly because such loops
// can compound a reputation problem quickly.
const KNOWN_SENDER_NUMBERS: ReadonlyArray<string> = [
  "+447401248976",
];

// Phone-shaped payload keys we walk for. The BookingConfirmed envelope is
// schema-loose (z.record(unknown)), so we scan recursively rather than
// trusting a fixed shape. Keys are matched exactly (case-sensitive); the
// list mirrors what command-executor.ts consumes plus the obvious
// adjacent forms.
const PHONE_FIELD_KEYS: ReadonlySet<string> = new Set([
  "customerPhone",
  "customer_phone",
  "identity_phone",
  "from",
  "phone",
  "phoneNumber",
  "phone_number",
]);

export type PhoneGuardOptions = {
  // Optional/nullable so callers that mock the env (notably the test
  // doubles for getCrmEnv) don't blow up when the new field is missing.
  // Real callers pass the parsed env.demoConsoleAllowlist value.
  allowlist?: ReadonlyArray<string> | null;
};

export type PhoneGuardResult =
  | { ok: true }
  | { ok: false; pattern: string };

export function evaluatePhoneNumber(
  raw: string | null | undefined,
  options: PhoneGuardOptions,
): PhoneGuardResult {
  if (raw == null) return { ok: true };
  const normalised = raw.trim();
  if (normalised.length === 0) return { ok: true };

  const allowlist = options.allowlist ?? [];
  if (allowlist.includes(normalised)) return { ok: true };
  if (normalised.startsWith(TWILIO_MAGIC_NUMBER_PREFIX)) return { ok: true };

  for (const prefix of KNOWN_SYNTHETIC_PREFIXES) {
    if (normalised.startsWith(prefix)) {
      return { ok: false, pattern: `known_synthetic_prefix:${prefix}` };
    }
  }

  if (KNOWN_SENDER_NUMBERS.includes(normalised)) {
    return { ok: false, pattern: "destination_matches_sender" };
  }

  return { ok: true };
}

export type CollectedPhone = {
  field: string;
  value: string;
};

export function collectPhonesFromPayload(payload: unknown): ReadonlyArray<CollectedPhone> {
  const found: CollectedPhone[] = [];

  function walk(node: unknown, path: string): void {
    if (node == null) return;
    if (typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nextPath = path.length === 0 ? key : `${path}.${key}`;
      if (typeof value === "string" && PHONE_FIELD_KEYS.has(key)) {
        found.push({ field: nextPath, value });
      } else {
        walk(value, nextPath);
      }
    }
  }

  walk(payload, "");
  return found;
}

export function parseAllowlistEnv(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
