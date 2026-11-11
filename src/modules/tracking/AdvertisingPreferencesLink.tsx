"use client";

import { OPEN_MEASUREMENT_CHOICES_EVENT } from "./measurement-consent";

/** Footer control that reopens the advertising measurement choice. */
export function AdvertisingPreferencesLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_MEASUREMENT_CHOICES_EVENT))}
    >
      Advertising preferences
    </button>
  );
}
