// Sentry runs in the user's browser here. Only errors + 1% of sessions
// get replayed, which keeps the free tier well within budget.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
