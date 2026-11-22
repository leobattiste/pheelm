import * as Sentry from "@sentry/nextjs";
import { IGNORED_ERRORS, SENTRY_DSN, SENTRY_ON, scrubBreadcrumb, scrubEvent } from "@/lib/sentry-scrub";

// Only the live site reports; local work and tests send nothing.
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ON,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  // A small share of requests is timed, enough to spot slow pages without a large bill.
  tracesSampleRate: 0.05,
  ignoreErrors: IGNORED_ERRORS,
  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
});
