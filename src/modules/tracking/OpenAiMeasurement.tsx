"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getMeasurementConsent, MEASUREMENT_CONSENT_EVENT, OPEN_MEASUREMENT_CHOICES_EVENT, setMeasurementConsent,
  type MeasurementConsent,
} from "./measurement-consent";
import { initializeOpenAiPixel, measureOpenAiPage, revokeOpenAiMeasurement } from "./openai-pixel";

export function OpenAiMeasurement({ pixelId, nonce }: { pixelId: string; nonce?: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<MeasurementConsent>(null);
  const [ready, setReady] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const lastMeasuredPath = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => { setConsent(getMeasurementConsent()); setReady(true); };
    const open = () => setShowChoices(true);
    sync();
    window.addEventListener(MEASUREMENT_CONSENT_EVENT, sync);
    window.addEventListener(OPEN_MEASUREMENT_CHOICES_EVENT, open);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MEASUREMENT_CONSENT_EVENT, sync);
      window.removeEventListener(OPEN_MEASUREMENT_CHOICES_EVENT, open);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!ready || !pixelId) return;
    if (consent !== "granted") {
      revokeOpenAiMeasurement();
      lastMeasuredPath.current = null;
      return;
    }
    if (initializeOpenAiPixel(pixelId, nonce) && lastMeasuredPath.current !== pathname) {
      measureOpenAiPage();
      lastMeasuredPath.current = pathname;
    }
  }, [consent, ready, pixelId, nonce, pathname]);

  if (!ready || !pixelId) return null;
  const choose = (value: "granted" | "denied") => {
    setMeasurementConsent(value);
    if (value === "denied") revokeOpenAiMeasurement();
    setShowChoices(false);
  };

  if (consent !== null && !showChoices) return null;

  // z-[60] keeps the choice above the website chat launcher (z-50), which
  // otherwise covers the "Allow" button on phones. Visitors reopen it later
  // from "Advertising preferences" in the site footer.
  return (
    <section aria-label="Advertising measurement preferences" className="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-xl rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-800 shadow-xl lg:bottom-4">
      <p className="font-semibold">Advertising measurement</p>
      <p className="mt-2">May we use OpenAI measurement cookies to understand which adverts lead to visits and enquiries? Your choice does not affect booking. <a href="/privacy" className="underline">Privacy details</a></p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => choose("denied")} className="rounded-lg border border-slate-500 px-4 py-2 font-semibold">Decline</button>
        <button type="button" onClick={() => choose("granted")} className="rounded-lg border border-slate-500 px-4 py-2 font-semibold">Allow measurement</button>
      </div>
    </section>
  );
}
