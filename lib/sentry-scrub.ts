/**
 * What Pheelm lets leave the site when an error is reported to Sentry.
 * No imports on purpose: the browser, server and edge setups all share it, and a test loads it alone.
 */

type Loose = { [key: string]: unknown };

// Query strings carry sign-in codes, unsubscribe tokens and search words, so only the path is kept.
const stripQuery = (url: unknown) => (typeof url === "string" ? url.split("?")[0].split("#")[0] : url);

// Errors that are not bugs: a page open across an update, or a browser cancelling a request.
const NOISE = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|ResizeObserver loop|AbortError|NEXT_REDIRECT|NEXT_NOT_FOUND/i;

export const IGNORED_ERRORS = [
  "ChunkLoadError",
  /Loading (CSS )?chunk/i,
  /dynamically imported module/i,
  /Importing a module script failed/i,
  /ResizeObserver loop/i,
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
];

/** Removes cookies, sign-in headers, request bodies, query strings and personal details from an event. */
export function scrubEvent<T extends object>(event: T): T | null {
  const e = event as Loose;
  const values = ((e.exception as Loose | undefined)?.values as Loose[] | undefined) ?? [];
  if (values.length && values.every((v) => NOISE.test(`${v.type ?? ""} ${v.value ?? ""}`))) return null;

  const request = e.request as Loose | undefined;
  if (request) {
    delete request.cookies;
    delete request.data;
    delete request.headers;
    delete request.env;
    request.url = stripQuery(request.url);
    delete request.query_string;
  }
  // Only a member's id helps to find a problem. Email, name and address stay out.
  const user = e.user as Loose | undefined;
  if (user) e.user = user.id ? { id: user.id } : undefined;

  const crumbs = e.breadcrumbs as Loose[] | undefined;
  if (Array.isArray(crumbs)) {
    for (const c of crumbs) {
      const data = c.data as Loose | undefined;
      if (!data) continue;
      for (const k of ["url", "from", "to"]) if (k in data) data[k] = stripQuery(data[k]);
    }
  }
  return event;
}

/** Same for breadcrumbs as they are recorded (clicks, navigation, fetches). */
export function scrubBreadcrumb<T extends object>(crumb: T): T {
  const c = crumb as Loose;
  const data = c.data as Loose | undefined;
  if (data) for (const k of ["url", "from", "to"]) if (k in data) data[k] = stripQuery(data[k]);
  if (c.category === "ui.input") delete c.message;
  return crumb;
}

/**
 * The project's public address for reports (it only lets events in, so it is safe in the code).
 * Reports are sent from the live site only; local work and tests stay quiet. Set NEXT_PUBLIC_SENTRY_DSN to
 * send somewhere else.
 */
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://8df4f0fa88b24d9a2679fa7c6dd23c06@o4512403675807744.ingest.us.sentry.io/4512403855441920";
export const SENTRY_ON = process.env.NODE_ENV === "production";
