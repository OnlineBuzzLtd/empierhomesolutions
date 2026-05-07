"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        selector: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "invisible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstile?: () => void;
  }
}

type TurnstileProps = {
  siteKey?: string;
  onToken: (token: string) => void;
  onError?: () => void;
  size?: "normal" | "compact" | "invisible";
};

/**
 * Cloudflare Turnstile widget. When no siteKey is provided (dev env without
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY) the component renders nothing — the server
 * side verifier bypasses verification outside production, so this is safe.
 */
export function Turnstile({ siteKey, onToken, onError, size = "normal" }: TurnstileProps) {
  const containerId = useId().replace(/[:]/g, "_");
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;

    function render() {
      if (!window.turnstile) return;
      const element = document.getElementById(containerId);
      if (!element || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(element, {
        sitekey: siteKey!,
        callback: onToken,
        "error-callback": onError,
        "expired-callback": () => onToken(""),
        size,
      });
    }

    if (window.turnstile) {
      render();
    } else {
      window.onloadTurnstile = render;
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [containerId, siteKey, onToken, onError, size]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstile"
        strategy="afterInteractive"
        async
      />
      <div id={containerId} data-testid="turnstile-container" />
    </>
  );
}
