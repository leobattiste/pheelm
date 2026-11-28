import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getCommunityCollections, MIN_FILMS, type CommunityCollection } from "@/lib/community";
import { getDirectors, getFilms, toDirectorSummary } from "@/lib/data";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import type { DirectorSummary, Film } from "@/lib/types";

/**
 * What the Explore page shows this week. Every weekly pick comes from the week number, so nobody has
 * to schedule anything, every visitor sees the same picks, and the page changes on Monday (UTC).
 * Each pool is put in a fixed order once (by a hash of its ids, so it isn't alphabetical) and the
 * week walks through it, so nothing comes round again before the whole pool has had its turn.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// 5 January 1970 was a Monday: weeks are counted from there, starting Monday 00:00 UTC.
const FIRST_MONDAY = Date.UTC(1970, 0, 5);

export function weekIndex(now = Date.now()) {
  return Math.floor((now - FIRST_MONDAY) / WEEK_MS);
}

/** The Monday this week started, as YYYY-MM-DD (the key an admin pin is stored under). */
export function weekStart(now = Date.now()) {
  return new Date(FIRST_MONDAY + weekIndex(now) * WEEK_MS).toISOString().slice(0, 10);
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The pool in its fixed order. */
function shuffled<T>(items: T[], id: (item: T) => string) {
  return [...items].sort((a, b) => hash(id(a)) - hash(id(b)) || id(a).localeCompare(id(b)));
}

/** `count` items starting at this week's place in the pool, wrapping round. */
/** The same items, reordered (as little as possible) so no two neighbours share a key. */
function spread<T>(items: T[], key: (item: T) => string): T[] {
  const ok = (list: T[]) => list.every((x, i) => i === 0 || key(x) !== key(list[i - 1]));
  if (ok(items)) return items;
  const perms = (list: T[]): T[][] => list.length <= 1 ? [list] : list.flatMap((x, i) => perms([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest]));
  return perms(items).find(ok) ?? items;
}

function rotate<T>(pool: T[], week: number, count: number) {
  if (!pool.length) return [];
  const n = Math.min(count, pool.length);
  const start = (((week * n) % pool.length) + pool.length) % pool.length;
  return Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length]);
}

// "Popular" on Pheelm means the most awarded: wins first, then nominations, then newer films.
const wins = (f: Film) => f.awards.filter((a) => a.result === "won").length;
const noms = (f: Film) => f.awards.length;
const byPopularity = (a: Film, b: Film) => wins(b) - wins(a) || noms(b) - noms(a) || b.year - a.year;
const complete = (f: Film) => !!f.poster_url && !!f.backdrop_url && !!f.synopsis;

async function pinnedFilmId(week: string) {
  if (!supabaseEnabled) return null;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.from("explore_pins").select("film_id").eq("week", week).maybeSingle();
  if (error) return null; // Not set up yet, or a slow moment: the automatic pick stands in.
  return (data?.film_id as string | undefined) ?? null;
}

export type Explore = {
  week: string;
  movieOfTheWeek: Film | null;
  pinned: boolean;
  popular: Film[];
  recent: Film[];
  spotlights: DirectorSummary[];
  aroundTheWorld: { country: string; film: Film }[];
  watchlists: CommunityCollection[];
  browse: Browse;
};

/** What "Keep exploring" links to: each card opens the Films page filtered that way. */
export type BrowseCard = { label: string; href: string; count: number; poster?: string | null; posters?: (string | null)[]; color?: string | null; logo?: string | null };
export type Browse = { decades: BrowseCard[]; genres: BrowseCard[]; services: BrowseCard[] };

// The big streaming services, in the order people look for them; only those with films here show.
const SERVICES = ["Netflix", "Max", "HBO Max", "Hulu", "Amazon Prime Video", "Disney Plus", "Apple TV Plus", "Apple TV", "Paramount Plus", "Peacock", "Criterion Channel", "MUBI", "Tubi"];

function browseLinks(films: Film[]): Browse {
  const q = (k: string, v: string) => `/films?${k}=${encodeURIComponent(v)}`;
  const top = (list: Film[]) => [...list].filter((f) => f.poster_url).sort(byPopularity);
  const group = (key: (f: Film) => string[]) => {
    const m = new Map<string, Film[]>();
    for (const f of films) for (const k of key(f)) m.set(k, [...(m.get(k) ?? []), f]);
    return m;
  };

  // Decades, oldest first, each behind the poster of its best-known film.
  const decades = [...group((f) => [`${Math.floor(f.year / 10) * 10}s`])]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, list]) => ({ label: d, href: q("decade", d), count: list.length, poster: top(list)[0]?.poster_url ?? null }));

  // Genres, most films first, tinted by their best-known film with two posters fanned on top.
  const genres = [...group((f) => f.genres)]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 14)
    .map(([g, list]) => {
      const best = top(list);
      return { label: g, href: q("genre", g), count: list.length, posters: best.slice(0, 2).map((f) => f.poster_url), color: best.find((f) => f.color)?.color ?? null };
    });

  // The big streaming services only, with TMDB's logo for each.
  const streams = group((f) => [...new Set((f.watch ?? []).filter((w) => w.kind === "stream" || w.kind === "free").map((w) => w.provider))]);
  const logos = new Map<string, string>();
  for (const f of films) for (const w of f.watch ?? []) if (w.logo && !logos.has(w.provider)) logos.set(w.provider, w.logo.replace("/w92/", "/w300/"));
  const services = SERVICES.filter((s) => streams.has(s)).map((s) => ({ label: s.replace(" Plus", "+"), href: q("provider", s), count: streams.get(s)!.length, logo: logos.get(s) ?? null }));

  return { decades, genres, services };
}

export async function getExplore(now = Date.now()): Promise<Explore> {
  const week = weekIndex(now);
  const start = weekStart(now);
  const [films, directors, collections, pin] = await Promise.all([
    getFilms(),
    getDirectors(),
    getCommunityCollections({ sort: "popular" }).catch(() => [] as CommunityCollection[]),
    pinnedFilmId(start),
  ]);
  const usable = films.filter((f) => !!f.poster_url);

  // Most popular: the most awarded films.
  const popular = [...usable].sort(byPopularity).slice(0, 12);

  // Movie of the week: the pinned film, or one of the 300 most popular films that have a synopsis
  // (and a trailer, when enough do), in turn.
  const pinned = pin ? films.find((f) => f.id === pin) ?? null : null;
  const candidates = [...usable].filter(complete).sort(byPopularity).slice(0, 300);
  const withTrailer = candidates.filter((f) => !!f.trailer_url);
  const pool = shuffled(withTrailer.length >= 52 ? withTrailer : candidates, (f) => f.id);
  const movieOfTheWeek = pinned ?? rotate(pool, week, 1)[0] ?? null;

  const recent = [...usable]
    .sort((a, b) => (b.published_at ?? b.created_at ?? "").localeCompare(a.published_at ?? a.created_at ?? ""))
    .slice(0, 12);

  // Director spotlight: four directors a week, all with at least five films on Pheelm. Two are
  // among the best known (judged by their films' awards) and two are less known, so the row mixes both.
  const fame = (d: { films: Film[] }) => d.films.reduce((n, f) => n + wins(f) * 3 + noms(f), 0);
  const eligible = directors.filter((d) => d.in_directory !== false && d.films.length >= 5);
  const ranked = [...eligible].sort((a, b) => fame(b) - fame(a) || a.id.localeCompare(b.id));
  const cut = Math.ceil(ranked.length / 3);
  const known = shuffled(ranked.slice(0, cut), (d) => d.id);
  const lesser = shuffled(ranked.slice(cut), (d) => d.id);
  // No more than two from one country, and never two from the same country side by side.
  const picked: typeof eligible = [];
  const perCountry = new Map<string, number>();
  const take = (pool: typeof eligible, n: number) => {
    const start = rotate(pool, week, 1)[0];
    if (!start) return;
    const from = pool.indexOf(start);
    for (let i = 0, got = 0; i < pool.length && got < n; i++) {
      const d = pool[(from + i) % pool.length];
      const c = d.country ?? `none-${d.id}`;
      if ((perCountry.get(c) ?? 0) >= 2 || picked.includes(d)) continue;
      perCountry.set(c, (perCountry.get(c) ?? 0) + 1);
      picked.push(d);
      got++;
    }
  };
  take(known, 2);
  take(lesser, 2);
  const spotlights = spread(picked, (d) => d.country ?? d.id).map(toDirectorSummary);

  // Around the world: eight countries a week, one popular film from each. Countries need at least
  // three films, so the film can change too: each country's turn takes the next of its top five.
  const byCountry = new Map<string, Film[]>();
  // A film counts for its main country (the first listed), so a co-production isn't shown as Belgian.
  for (const f of usable) { const c = f.countries[0]; if (c) byCountry.set(c, [...(byCountry.get(c) ?? []), f]); }
  const countries = shuffled([...byCountry.keys()].filter((c) => (byCountry.get(c)?.length ?? 0) >= 3), (c) => c);
  const turn = Math.floor((week * 8) / Math.max(1, countries.length));
  const used = new Set<string>();
  const aroundTheWorld = rotate(countries, week, 8).flatMap((country) => {
    const top = byCountry.get(country)!.filter((f) => !used.has(f.id)).sort(byPopularity).slice(0, 5);
    const film = top[turn % Math.max(1, top.length)];
    if (!film) return [];
    used.add(film.id);
    return [{ country, film }];
  });

  // Community watchlists: four a week, from those with at least five films.
  const watchlists = rotate(shuffled(collections.filter((c) => c.films.length >= MIN_FILMS), (c) => c.id), week, 4);

  return { week: start, movieOfTheWeek, pinned: !!pinned, popular, recent, spotlights, aroundTheWorld, watchlists, browse: browseLinks(films) };
}
