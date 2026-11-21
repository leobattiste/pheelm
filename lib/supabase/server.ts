import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./config";

/** A client that acts as the signed-in visitor. Use it only in dynamic pages and actions. */
export async function getServerClient() {
  if (!supabaseEnabled) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component; the middleware refreshes the session instead.
        }
      },
    },
  });
}

/** The token carries the same metadata as the account (as of its last refresh). */
export type Viewer = { id: string; email: string | null; user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown> };

/**
 * Who's signed in, from their session token, checked against the project's signing keys
 * without a call to the sign-in service. `auth.getUser()` asks that service every time, and when
 * it is busy (it shares the small database with everything else) the answer was an error: members
 * were then shown as signed out, or sent to Sign in from their own pages.
 */
export async function getViewer(db: { auth: { getClaims: () => Promise<{ data: { claims: Record<string, unknown> } | null; error: unknown }> } } | null): Promise<Viewer | null> {
  if (!db) return null;
  try {
    const { data, error } = await db.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!error && typeof sub === "string") {
      const c = data!.claims;
      const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
      return { id: sub, email: typeof c.email === "string" ? c.email : null, user_metadata: obj(c.user_metadata), app_metadata: obj(c.app_metadata) };
    }
  } catch {}
  return null;
}
