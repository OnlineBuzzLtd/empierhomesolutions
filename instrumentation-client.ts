// Client-side Sentry init. Next.js 16 looks for this file alongside
// `instrumentation.ts` and runs it in the browser. Guarded by env so the
// SDK is a zero-cost no-op when SENTRY_DSN is unset.

import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
    tracesSampleRate: Number.parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
    ),
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
  });
}
