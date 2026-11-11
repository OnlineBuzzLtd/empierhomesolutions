import { getMeasurementConsent } from "./measurement-consent";

type PixelCommand = (...args: unknown[]) => void;
type PixelQueue = PixelCommand & { q?: unknown[][] };

declare global {
  interface Window {
    oaiq?: PixelQueue;
  }
}

let initializedPixel: string | null = null;

export function initializeOpenAiPixel(pixelId: string, nonce?: string) {
  if (!pixelId || getMeasurementConsent() !== "granted") return false;
  if (initializedPixel === pixelId) {
    window.oaiq?.("consent", true);
    return true;
  }
  if (!window.oaiq) {
    const queue: PixelQueue = (...args: unknown[]) => { queue.q!.push(args); };
    queue.q = [];
    window.oaiq = queue;
  }
  window.oaiq("consent", true);
  window.oaiq("init", { pixelId });
  initializedPixel = pixelId;

  if (!document.getElementById("ehs-openai-pixel")) {
    const script = document.createElement("script");
    script.id = "ehs-openai-pixel";
    script.async = true;
    script.src = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
    if (nonce) script.nonce = nonce;
    script.onerror = () => {
      // Allow a subsequent page/consent interaction to retry a failed load.
      script.remove();
      initializedPixel = null;
    };
    document.head.appendChild(script);
  }
  return true;
}

export function revokeOpenAiMeasurement() {
  // Don't replay queued events if the visitor revokes before the SDK loads.
  if (window.oaiq?.q) {
    window.oaiq.q = window.oaiq.q.filter((args) => args[0] !== "measure");
  }
  window.oaiq?.("consent", false);
  for (const name of ["__oppref", "__obref"]) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}

export function measureOpenAiPage() {
  if (getMeasurementConsent() !== "granted" || !initializedPixel) return;
  window.oaiq?.("measure", "page_viewed", { type: "contents" }, {
    event_id: `page_${crypto.randomUUID()}`,
    opt_out: true,
  });
}

/** The server supplies an opaque ID only after saving the CRM lead. */
export function measureOpenAiLead(eventId: unknown) {
  if (getMeasurementConsent() !== "granted" || !initializedPixel) return;
  if (typeof eventId !== "string" || !/^ehs_lead_[a-f0-9]{64}$/.test(eventId)) return;
  try {
    window.oaiq?.("measure", "lead_created", { type: "customer_action" }, {
      event_id: eventId,
      opt_out: true,
    });
  } catch {
    // Measurement must never turn a saved enquiry into a failed form.
  }
}
