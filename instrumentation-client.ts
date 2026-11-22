import * as Sentry from "@sentry/nextjs";
import { IGNORED_ERRORS, SENTRY_DSN, SENTRY_ON, scrubBreadcrumb, scrubEvent } from "@/lib/sentry-scrub";

// Reports errors from members' browsers. No session recordings: they would capture what people type.
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ON,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  ignoreErrors: IGNORED_ERRORS,
  // Errors from browser extensions and other sites' scripts are not Pheelm's.
  denyUrls: [/^chrome-extension:/i, /^moz-extension:/i, /^safari-(web-)?extension:/i],
  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
