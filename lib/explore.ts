import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getCommunityCollections, MIN_FILMS, type CommunityCollection } from "@/lib/community";
import { getDirectors, getFilms } from "@/lib/data";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import type { Director, Film } from "@/lib/types";

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
function rotate<T>(pool: T[], week: number, count: number) {
  if (!pool.length) return [];
  const n = Math.min(count, pool.length);
  const start = (((week * n) % pool.length) + pool.length) % pool.length;
  return Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length]);
}

const popularity = (f: Film) => f.popularity ?? 0;
const byPopularity = (a: Film, b: Film) => popularity(b) - popularity(a) || b.year - a.year;
const complete = (f: Film) => !!f.poster_url && !!f.synopsis;

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
  spotlight: Director | null;
  aroundTheWorld: { country: string; film: Film }[];
  watchlists: CommunityCollection[];
  browse: Browse;
};

/** What "Keep exploring" links to: each chip opens the Films page filtered that way. */
export type Browse = {
  decades: { label: string; href: string }[];
  genres: { label: string; href: string }[];
  services: { label: string; href: string }[];
  themes: { label: string; href: string }[];
};

// The big streaming services, in the order people look for them; only those with films here show.
const SERVICES = ["Netflix", "Max", "HBO Max", "Hulu", "Amazon Prime Video", "Disney Plus", "Apple TV Plus", "Apple TV", "Paramount Plus", "Peacock", "Criterion Channel", "MUBI", "Tubi"];

async function themeCollections() {
  if (!supabaseEnabled) return [] as { slug: string; title: string }[];
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.from("collections").select("slug,title").eq("kind", "theme").order("sort_order");
  return error ? [] : ((data ?? []) as { slug: string; title: string }[]);
}

function browseLinks(films: Film[], themes: { slug: string; title: string }[]): Browse {
  const count = <T,>(items: T[]) => {
    const m = new Map<T, number>();
    for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
    return m;
  };
  const decades = [...count(films.map((f) => Math.floor(f.year / 10) * 10)).keys()].sort((a, b) => a - b);
  const genres = [...count(films.flatMap((f) => f.genres)).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14).map(([g]) => g);
  const providers = new Set(films.flatMap((f) => (f.watch ?? []).filter((w) => w.kind === "stream" || w.kind === "free").map((w) => w.provider)));
  const services = SERVICES.filter((s) => providers.has(s));
  const q = (k: string, v: string) => `/films?${k}=${encodeURIComponent(v)}`;
  return {
    decades: decades.map((d) => ({ label: `${d}s`, href: q("decade", `${d}s`) })),
    genres: genres.map((g) => ({ label: g, href: q("genre", g) })),
    services: services.map((s) => ({ label: s, href: q("provider", s) })),
    themes: themes.map((t) => ({ label: t.title, href: `/collections/${t.slug}` })),
  };
}

export async function getExplore(now = Date.now()): Promise<Explore> {
  const week = weekIndex(now);
  const start = weekStart(now);
  const [films, directors, collections, pin, themes] = await Promise.all([
    getFilms(),
    getDirectors(),
    getCommunityCollections({ sort: "popular" }).catch(() => [] as CommunityCollection[]),
    pinnedFilmId(start),
    themeCollections(),
  ]);
  const usable = films.filter((f) => !!f.poster_url);
  const hasPopularity = usable.some((f) => f.popularity != null);

  // Most popular: TMDB's worldwide score. Until the job has run, the films with the most wins stand in.
  const wins = (f: Film) => f.awards.filter((a) => a.result === "won").length;
  const popular = [...usable].sort(hasPopularity ? byPopularity : (a, b) => wins(b) - wins(a) || b.year - a.year).slice(0, 12);

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

  // Director spotlight: one director a week, from everyone with at least five films on Pheelm.
  const eligible = shuffled(directors.filter((d) => d.in_directory !== false && d.films.length >= 5), (d) => d.id);
  const chosen = rotate(eligible, week, 1)[0] ?? null;
  const spotlight = chosen ? { ...chosen, films: [...chosen.films].filter((f) => !!f.poster_url).sort(byPopularity) } : null;

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

  return { week: start, movieOfTheWeek, pinned: !!pinned, popular, recent, spotlight, aroundTheWorld, watchlists, browse: browseLinks(films, themes) };
}
