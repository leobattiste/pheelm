import * as Sentry from "@sentry/nextjs";
import { IGNORED_ERRORS, SENTRY_DSN, SENTRY_ON, scrubBreadcrumb, scrubEvent } from "@/lib/sentry-scrub";

// The edge runtime runs the sign-in gate (proxy.ts). Same rules as the server.
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ON,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  ignoreErrors: IGNORED_ERRORS,
  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
});
