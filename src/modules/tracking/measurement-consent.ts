export const MEASUREMENT_CONSENT_KEY = "ehs_ad_measurement_consent_v1";
export const MEASUREMENT_CONSENT_EVENT = "ehs:measurement-consent";
export const OPEN_MEASUREMENT_CHOICES_EVENT = "ehs:open-measurement-choices";
export type MeasurementConsent = "granted" | "denied" | null;

let currentChoice: MeasurementConsent = null;

export function getMeasurementConsent(): MeasurementConsent {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(MEASUREMENT_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : currentChoice;
  } catch {
    return currentChoice;
  }
}

export function setMeasurementConsent(value: Exclude<MeasurementConsent, null>) {
  currentChoice = value;
  try {
    window.localStorage.setItem(MEASUREMENT_CONSENT_KEY, value);
  } catch {
    // A visitor can still choose for this page when storage is unavailable.
  }
  window.dispatchEvent(new Event(MEASUREMENT_CONSENT_EVENT));
}
