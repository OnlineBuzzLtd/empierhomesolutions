export type DataLayerEvent = {
  event: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number | string;
};

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function pushDataLayer(payload: DataLayerEvent) {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

export function trackCallClick(source: "hero" | "sticky") {
  pushDataLayer({
    event: source === "hero" ? "cta_call_click" : "sticky_call_click",
    category: "engagement",
    action: "click",
    label: source,
  });
}

export function trackWhatsappClick(source: "sticky" | "homepage") {
  pushDataLayer({
    event: "whatsapp_click",
    category: "engagement",
    action: "click",
    label: source,
  });
}

export function trackFormEvent(
  type: "form_start" | "form_submit" | "form_submit_attempt" | "form_success" | "form_error",
  label?: string,
) {
  pushDataLayer({
    event: type,
    category: "lead_form",
    action: type,
    label,
  });
}

export function trackFaqExpand(questionId: string) {
  pushDataLayer({
    event: "faq_expand",
    category: "engagement",
    action: "expand",
    label: questionId,
  });
}
