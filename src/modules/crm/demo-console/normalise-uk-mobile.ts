// Best-effort UK mobile number → E.164 normaliser for the Demo
// Console consent form. Operators type natural UK phrasings ("07700
// 900123", "0044 7700 900123", "(+44) 7700-900123") and we send them
// through Twilio / WhatsApp links that require strict E.164.
//
// Returns the original input untouched when it doesn't look like a
// UK mobile — keeps non-UK numbers, sandbox numbers, and Twilio
// Magic Numbers (+150055500…) passing through unchanged.

export function normaliseUkMobileToE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return trimmed;

  // Already E.164 (+44…, +1500…, anything starting with + followed by
  // a country code). Strip internal whitespace / dashes / parens but
  // keep the leading +.
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/[^\d]/g, "");
  }

  // Strip everything except digits and a leading + for further checks.
  const digitsOnly = trimmed.replace(/[^\d]/g, "");
  if (digitsOnly.length === 0) return trimmed;

  // 00-prefixed international: "0044 7700 900123" → "+447700900123".
  if (digitsOnly.startsWith("00")) {
    return "+" + digitsOnly.slice(2);
  }

  // UK domestic mobile shape: starts with 07, exactly 11 digits.
  if (digitsOnly.startsWith("07") && digitsOnly.length === 11) {
    return "+44" + digitsOnly.slice(1);
  }

  // UK mobile minus the leading 0: "7700900123" (10 digits, starts 7).
  // Common when operators paste from spreadsheets that stripped the 0.
  if (digitsOnly.startsWith("7") && digitsOnly.length === 10) {
    return "+44" + digitsOnly;
  }

  // Anything else: return as-is. Don't guess; let the downstream
  // synthetic-number guard or Twilio reject it explicitly.
  return trimmed;
}
