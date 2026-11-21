"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./config";

/** Past this, a request from the browser gives up, so no button or section can wait forever. */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * fetch with a time limit. A request the database never answers (an outage, a stuck sign-in
 * refresh) used to leave whatever waited on it spinning for good; now it fails, and the caller
 * shows its error or "Try again". A caller's own abort signal still works alongside the limit.
 */
export const fetchWithTimeout: typeof fetch = (input, init = {}) => {
  // Older browsers (Safari before 16 / 17.4) lack these; there the request runs as before.
  if (typeof AbortSignal.timeout !== "function") return fetch(input, init);
  const limit = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!init.signal) return fetch(input, { ...init, signal: limit });
  if (typeof AbortSignal.any !== "function") return fetch(input, init);
  return fetch(input, { ...init, signal: AbortSignal.any([init.signal, limit]) });
};

let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: fetchWithTimeout } });
  return client;
}
