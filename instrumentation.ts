// Next.js instrumentation hook: runs once per server process before any
// request is served. We use it to initialise Sentry on the server and edge
// runtimes. Client-side init lives in `instrumentation-client.ts`.

export async function register() {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
      tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      profilesSampleRate: 0,
      sendDefaultPii: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
      tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    });
  }
}

// Next 15+ surfaces request errors through this hook. Forward to Sentry so
// the nearest error boundary and RSC errors are captured automatically.
export async function onRequestError(
  err: unknown,
  request: Parameters<
    NonNullable<typeof import("@sentry/nextjs").captureRequestError>
  >[1],
  context: Parameters<
    NonNullable<typeof import("@sentry/nextjs").captureRequestError>
  >[2],
) {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
