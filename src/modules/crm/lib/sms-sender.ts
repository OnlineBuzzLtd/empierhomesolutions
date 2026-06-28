import { evaluatePhoneNumber, parseAllowlistEnv } from "@/modules/platform/lib/synthetic-number-guard";

type SendSmsInput = {
  to: string;
  body: string;
  messagingServiceSid?: string | null;
};

function normalizeEnv(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

export async function sendTenantSms(input: SendSmsInput): Promise<{ ok: boolean; warning?: string }> {
  const guard = evaluatePhoneNumber(input.to, {
    allowlist: parseAllowlistEnv(process.env.DEMO_CONSOLE_ALLOWLIST),
  });
  if (!guard.ok) {
    return {
      ok: false,
      warning: `Twilio destination blocked by synthetic-number guard: ${guard.pattern}.`,
    };
  }

  const accountSid = normalizeEnv(process.env.TWILIO_ACCOUNT_SID);
  const authToken = normalizeEnv(process.env.TWILIO_AUTH_TOKEN);
  const apiKeySid = normalizeEnv(process.env.TWILIO_API_KEY_SID);
  const apiKeySecret = normalizeEnv(process.env.TWILIO_API_KEY_SECRET);
  const messagingServiceSid =
    input.messagingServiceSid ??
    normalizeEnv(process.env.CRM_TWILIO_MESSAGING_SERVICE_SID) ??
    normalizeEnv(process.env.TWILIO_MESSAGING_SERVICE_SID);
  const from = normalizeEnv(process.env.CRM_TWILIO_FROM_NUMBER) ?? normalizeEnv(process.env.TWILIO_PHONE_NUMBER);

  const authUsername = apiKeySid ?? accountSid;
  const authPassword = apiKeySecret ?? authToken;

  if (!accountSid || !authUsername || !authPassword) {
    return { ok: false, warning: "Twilio account credentials are not configured." };
  }

  if (!messagingServiceSid && !from) {
    return { ok: false, warning: "Twilio sender is not configured." };
  }

  const body = new URLSearchParams({
    To: input.to,
    Body: input.body,
  });
  if (messagingServiceSid) {
    body.set("MessagingServiceSid", messagingServiceSid);
  } else if (from) {
    body.set("From", from);
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${authUsername}:${authPassword}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    return { ok: false, warning: `Twilio ${response.status}: ${responseBody.slice(0, 200)}` };
  }

  return { ok: true };
}
