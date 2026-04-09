// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable if DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_PUBLIC_SENTRY_DSN !== 'https://examplePublicKey@o0.ingest.sentry.io/0',

  // Performance Monitoring - low sample rate for free tier
  tracesSampleRate: 0.1,

  // Filter out noise
  ignoreErrors: [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ],

  environment: process.env.NODE_ENV,
});
