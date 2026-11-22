import * as Sentry from "@sentry/nextjs";

/** Loads the error reporting for whichever runtime this server code runs in. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Failures while rendering pages, running server actions and route handlers.
export const onRequestError = Sentry.captureRequestError;
