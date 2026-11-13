import type { SupabaseClient } from "@supabase/supabase-js";
import type { Film } from "./types";

/** What a signed-in member's Home is built from: their own saves, follows and watched films. */
export type HomeData = {
  name: string | null;
  unread: number;
  /** One suggestion at the top: a new film from a followed director, the next film to watch, or how to start. */
  next: { kind: "new"; film: Film; director: string } | { kind: "watchlist"; film: Film } | { kind: "start" };
  followed: { film: Film; isNew: boolean }[];
  watchlist: Film[];
  watchlistTotal: number;
  because: { seed: Film; films: Film[] } | null;
  following: { directors: number; watched: number };
};

const NEW_DAYS = 30;
const recent = (iso: string | undefined, days: number) => !!iso && Date.now() - new Date(iso).getTime() < days * 86400000;

/**
 * Builds Home from the catalog (already cached) and the member's own rows, read with their
 * session so nothing private to anyone else is involved. Rows that fail to load are treated as empty.
 */
export async function getHome(db: SupabaseClient, userId: string, films: Film[]): Promise<HomeData> {
  const [profile, saved, follows, watched, unread] = await Promise.all([
    db.from("profiles").select("display_name, handle").eq("id", userId).maybeSingle(),
    db.from("watchlist").select("film_id, added_at").eq("user_id", userId).order("added_at", { ascending: false }),
    db.from("follows").select("person_id").eq("user_id", userId),
    db.from("watched").select("film_id, watched_at").eq("user_id", userId).order("watched_at", { ascending: false }).limit(50),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  const byId = new Map(films.map((f) => [f.id, f]));
  const seen = new Set(((watched.data ?? []) as { film_id: string }[]).map((w) => w.film_id));
  const savedIds = ((saved.data ?? []) as { film_id: string }[]).map((s) => s.film_id);
  const savedSet = new Set(savedIds);
  const followedPeople = new Set(((follows.data ?? []) as { person_id: string }[]).map((f) => f.person_id));

  // Films by directors you follow, newest added first.
  const followed = films
    .filter((f) => f.directors.some((d) => followedPeople.has(d.id)))
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.year - a.year)
    .slice(0, 12)
    .map((film) => ({ film, isNew: recent(film.created_at, NEW_DAYS) }));

  // Your Watchlist, minus what you've already watched.
  const toWatch = savedIds.map((id) => byId.get(id)).filter((f): f is Film => !!f && !seen.has(f.id));

  // Because you watched: films closest to the one you watched last (same director counts most),
  // nudged by everything else you've watched. Never something you've seen or saved.
  const watchedFilms = ((watched.data ?? []) as { film_id: string }[]).map((w) => byId.get(w.film_id)).filter((f): f is Film => !!f);
  let because: HomeData["because"] = null;
  const seed = watchedFilms[0];
  if (seed) {
    const like = (a: Film, b: Film) =>
      (a.directors.some((d) => b.directors.some((e) => e.id === d.id)) ? 5 : 0)
      + a.countries.filter((c) => b.countries.includes(c)).length
      + a.genres.filter((g) => b.genres.includes(g)).length;
    const scored = films
      .filter((f) => !seen.has(f.id) && !savedSet.has(f.id))
      .map((f) => ({ f, score: like(f, seed) * 3 + watchedFilms.slice(1, 20).reduce((sum, w) => sum + like(f, w), 0) }))
      .filter((s) => s.score >= 6)
      .sort((a, b) => b.score - a.score || b.f.year - a.f.year)
      .slice(0, 12)
      .map((s) => s.f);
    if (scored.length >= 3) because = { seed, films: scored };
  }

  const fresh = followed.find((x) => x.isNew && !seen.has(x.film.id) && !savedSet.has(x.film.id));
  const next: HomeData["next"] = fresh
    ? { kind: "new", film: fresh.film, director: fresh.film.directors.find((d) => followedPeople.has(d.id))?.name ?? fresh.film.directors[0]?.name ?? "" }
    : toWatch[0] ? { kind: "watchlist", film: toWatch[0] } : { kind: "start" };

  const p = (profile.data ?? null) as { display_name: string | null; handle: string | null } | null;
  return {
    name: p?.display_name?.trim() || null,
    unread: unread.error ? 0 : unread.count ?? 0,
    next,
    followed,
    watchlist: toWatch.slice(0, 12),
    watchlistTotal: toWatch.length,
    because,
    following: { directors: followedPeople.size, watched: seen.size },
  };
}
