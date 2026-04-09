// This file configures the initialization of Sentry for edge features (middleware, edge routes, etc).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable if DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_PUBLIC_SENTRY_DSN !== 'https://examplePublicKey@o0.ingest.sentry.io/0',

  // Performance Monitoring
  tracesSampleRate: 0.1,

  environment: process.env.NODE_ENV,
});
