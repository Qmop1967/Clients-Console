// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable if DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_PUBLIC_SENTRY_DSN !== 'https://examplePublicKey@o0.ingest.sentry.io/0',

  // Performance Monitoring - low sample rate for free tier
  tracesSampleRate: 0.1,

  // Session Replay - minimal for free tier
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  // Filter out noise
  ignoreErrors: [
    'ResizeObserver loop',
    'Network request failed',
    'Load failed',
    'ChunkLoadError',
    'Loading chunk',
  ],

  environment: process.env.NODE_ENV,
});
