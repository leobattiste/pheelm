"use client";

import { getBrowserClient } from "@/lib/supabase/client";

/**
 * The signed-in member's own rows (films on their Watchlist, films they've watched, directors
 * and watchlists they follow), read once per page and shared by every button that needs them.
 *
 * Each read has a time limit. A busy database used to leave buttons waiting (greyed out, or
 * worse, pointing a signed-in member to Sign in) for as long as it took, or forever. Now a read
 * that doesn't answer in time fails, and the button says so instead of hanging.
 */
export type MyTable = "watchlist" | "watched" | "follows" | "list_saves";
const COLUMN: Record<MyTable, string> = { watchlist: "film_id", watched: "film_id", follows: "person_id", list_saves: "list_id" };

export const SESSION_MS = 5_000;
export const READ_MS = 10_000;

/** `work`, or a rejection after `ms`. */
export function within<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([Promise.resolve(work), new Promise<never>((_, fail) => setTimeout(() => fail(new Error("timeout")), ms))]);
}

let me: Promise<string | null> | null = null;
let listening = false;
const sets = new Map<MyTable, Promise<{ userId: string; ids: Set<string> } | null>>();

function forget() { me = null; sets.clear(); }

/** Who is signed in (null when signed out). A sign-in check that never answers counts as signed out. */
export function myId(): Promise<string | null> {
  const db = getBrowserClient();
  if (!db) return Promise.resolve(null);
  if (!listening) {
    listening = true;
    db.auth.onAuthStateChange(event => { if (event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED") forget(); });
  }
  if (!me) {
    const ask = within(db.auth.getSession(), SESSION_MS).then(({ data }) => data.session?.user.id ?? null);
    me = ask;
    ask.catch(() => { if (me === ask) me = null; });
  }
  return me.catch(() => null);
}

/**
 * The ids in one of the member's tables: null when signed out. Rejects when the read fails or
 * runs out of time (and isn't kept, so the next ask tries again).
 */
export function myIds(table: MyTable): Promise<{ userId: string; ids: Set<string> } | null> {
  const known = sets.get(table);
  if (known) return known;
  const ask = (async () => {
    const userId = await myId();
    if (!userId) return null;
    const db = getBrowserClient()!;
    const { data, error } = await within(db.from(table).select(COLUMN[table]).eq("user_id", userId), READ_MS);
    if (error) throw error;
    return { userId, ids: new Set(((data ?? []) as unknown as Record<string, string>[]).map(r => r[COLUMN[table]])) };
  })();
  sets.set(table, ask);
  ask.catch(() => { if (sets.get(table) === ask) sets.delete(table); });
  return ask;
}

/** Keep the shared copy in step after a save or removal. */
export function noteMine(table: MyTable, id: string, on: boolean) {
  void sets.get(table)?.then(s => { if (s) { if (on) s.ids.add(id); else s.ids.delete(id); } }).catch(() => {});
}
