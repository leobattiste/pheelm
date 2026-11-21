import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getFilmCards } from "./data";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./supabase/config";
import type { FilmCard } from "./types";
import type { Sort, WatchlistTile } from "./collection-sorts";

/** A collection to list in the community: needs a title, this many films and a member name. */
export const MIN_FILMS = 5;

export type Member = { id: string; handle: string; display_name: string | null; is_private?: boolean; country?: string | null; bio?: string | null; avatar_url?: string | null; social_platform?: string | null; social_url?: string | null; website_url?: string | null };

// Asks for the private setting, country and bio too, and falls back to the basic columns until profiles-private.sql has run.
const FULL = "id, handle, display_name, is_private, country, bio, avatar_url, social_platform, social_url, website_url";
const BASIC = "id, handle, display_name";
async function members<T>(run: (cols: string) => PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  const first = await run(FULL);
  if (!first.error) return first.data;
  return (await run(BASIC)).data;
}
export type CommunityCollection = {
  id: string;
  slug?: string;
  title: string;
  description: string | null;
  staff_pick: boolean;
  /** Featured by an admin (staff picks are featured too). */
  featured: boolean;
  created_at: string;
  /** The last change: an edit, or the newest film added. */
  updated_at: string;
  films: FilmCard[];
  /** Used to rank "Popular"; never shown. */
  saves: number;
  owner: Member | null;
  /** How many co-curators work on it with the owner. */
  curators: number;
};

// Read as a visitor (no cookies), so these pages can be cached like the rest of the catalog.
const anon = () => (supabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }) : null);

export type Row = { id: string; slug?: string; title: string; description: string | null; staff_pick?: boolean; featured?: boolean; created_at: string; updated_at?: string | null; user_id: string; list_films: { film_id: string; added_at: string }[] };

const ROW_COLS = "id, slug, title, description, staff_pick, featured, created_at, updated_at, user_id, list_films(film_id, added_at)";
const ROW_COLS_BASIC = "id, slug, title, description, staff_pick, created_at, updated_at, user_id, list_films(film_id, added_at)";
/** Runs a lists query, without the featured column until admins-watched-blocks.sql has run. */
async function lists(run: (cols: string) => PromiseLike<{ data: unknown; error: unknown }>) {
  const first = await run(ROW_COLS);
  return first.error ? run(ROW_COLS_BASIC) : first;
}

/** Joins rows with their films (newest first), owners and save counts. */
export async function enrich(rows: Row[]): Promise<CommunityCollection[]> {
  const db = anon();
  if (!db || !rows.length) return [];
  const ids = rows.map((r) => r.id);
  const owners = [...new Set(rows.map((r) => r.user_id))];
  // Only the films on these lists, as cards: not the whole catalogue.
  const [films, people, counts, crew] = await Promise.all([
    getFilmCards(rows.flatMap((r) => r.list_films.map((x) => x.film_id))),
    members((cols) => db.from("member_profiles").select(cols).in("id", owners)),
    db.from("list_save_counts").select("list_id, saves").in("list_id", ids),
    db.from("list_members").select("list_id").eq("status", "active").in("list_id", ids),
  ]);
  const crewById = new Map<string, number>();
  for (const r of (crew.data ?? []) as { list_id: string }[]) crewById.set(r.list_id, (crewById.get(r.list_id) ?? 0) + 1);
  const byId = new Map(films.map((f) => [f.id, f]));
  const ownerById = new Map(((people ?? []) as unknown as Member[]).map((p) => [p.id, p]));
  const savesById = new Map(((counts.data ?? []) as { list_id: string; saves: number }[]).map((c) => [c.list_id, c.saves]));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    staff_pick: !!r.staff_pick,
    featured: !!r.staff_pick || !!r.featured,
    created_at: r.created_at,
    updated_at: [r.updated_at ?? r.created_at, ...r.list_films.map((x) => x.added_at)].sort().at(-1)!,
    // Staff collections in year order (their covers show where they begin); members' newest first.
    films: [...r.list_films]
      .sort((a, b) => r.staff_pick ? (byId.get(a.film_id)?.year ?? 0) - (byId.get(b.film_id)?.year ?? 0) : b.added_at.localeCompare(a.added_at))
      .map((x) => byId.get(x.film_id)).filter((f): f is FilmCard => !!f),
    saves: savesById.get(r.id) ?? 0,
    owner: ownerById.get(r.user_id) ?? null,
    curators: crewById.get(r.id) ?? 0,
  }));
}

export { SORTS, type Sort } from "./collection-sorts";
const order: Record<Sort, (a: CommunityCollection, b: CommunityCollection) => number> = {
  popular: (a, b) => Number(b.staff_pick) - Number(a.staff_pick) || b.saves - a.saves || b.created_at.localeCompare(a.created_at),
  new: (a, b) => b.created_at.localeCompare(a.created_at),
  updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
  films: (a, b) => b.films.length - a.films.length || b.saves - a.saves,
};

/**
 * Every qualifying collection, read once and shared for half a minute by every page this server
 * renders (they're public, and the same for everyone), instead of on every visit.
 */
const FRESH_FOR = 30_000;
let shared: { at: number; data: Promise<CommunityCollection[]> } | null = null;
function qualifying() {
  if (shared && Date.now() - shared.at < FRESH_FOR) return shared.data;
  const data = (async () => {
    const db = anon();
    if (!db) return [];
    const { data, error } = await lists((cols) => db
      .from("lists")
      .select(cols)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(1000));
    if (error) throw error;
    // Staff picks always show; other collections need a member name and at least five films.
    return (await enrich(data as unknown as Row[])).filter((c) => c.owner && (c.staff_pick || c.films.length >= MIN_FILMS));
  })();
  shared = { at: Date.now(), data };
  // A failed read isn't kept, so the next visit tries again.
  return data.catch(() => { if (shared?.data === data) shared = null; return [] as CommunityCollection[]; });
}

/**
 * Every public collection that qualifies for the Collections page: a title, a member name, and at
 * least five films (staff picks always qualify). Staff picks lead the popular order. Optionally
 * only those that include one film.
 */
export async function getCommunityCollections({ sort = "popular", filmId, limit }: { sort?: Sort; filmId?: string; limit?: number } = {}) {
  let all = [...(await qualifying())];
  if (filmId) all = all.filter((c) => c.films.some((f) => f.id === filmId));
  all.sort(order[sort]);
  return limit ? all.slice(0, limit) : all;
}

/** Shared only within a render: metadata and the page use one lightweight profile read. */
export const getMemberProfile = cache(async (handle: string): Promise<Member | null> => {
  const db = anon();
  if (!db) return null;
  const { data, error } = await db.from("member_profiles").select(FULL).eq("handle", handle.toLowerCase()).maybeSingle();
  if (error) throw new Error("Could not load member profile: " + error.message);
  return data as Member | null;
});

/** The owner and save count for one collection page. */
export async function collectionExtras(listId: string, userId: string) {
  const db = anon();
  if (!db) return { owner: null, saves: 0 };
  const [owner, counts] = await Promise.all([
    members((cols) => db.from("member_profiles").select(cols).eq("id", userId).maybeSingle()),
    db.from("list_save_counts").select("saves").eq("list_id", listId).maybeSingle(),
  ]);
  return { owner: (owner as unknown as Member | null) ?? null, saves: (counts.data as { saves: number } | null)?.saves ?? 0 };
}

/** The collection that used to live at /collections/<slug>, before Pheelm's own moved into @leo's. */
export async function collectionIdForLegacySlug(slug: string) {
  const db = anon();
  if (!db) return null;
  const { data } = await db.from("lists").select("id").eq("legacy_slug", slug).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Anonymous reads include only profiles whose owners have made them public. */
export async function getPublicProfileHandles():Promise<string[]> {
 const db=anon();if(!db)return [];
 const handles:string[]=[];
 for(let from=0;;from+=1000){
  const {data,error}=await db.from('member_profiles').select('handle').eq('is_private',false).order('handle').range(from,from+999);
  if(error)return [];
  for(const row of data??[])if(/^[a-z0-9_]{3,24}$/.test(row.handle))handles.push(row.handle);
  if(!data || data.length<1000)return handles;
 }
}

/**
 * Every qualifying collection for the Watchlists page, read without loading the whole film
 * catalog: only the first three films of each list (for the poster fan) are fetched. Cached for a
 * few minutes and refreshed by the "watchlists" tag.
 */
export type { WatchlistTile };
export const getWatchlistTiles = unstable_cache(async (): Promise<WatchlistTile[]> => {
  const db = anon();
  if (!db) return [];
  const { data, error } = await lists((cols) => db.from("lists").select(cols).eq("is_public", true).order("created_at", { ascending: false }).limit(1000));
  if (error) throw error;
  const rows = data as unknown as Row[];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const owners = [...new Set(rows.map((r) => r.user_id))];
  const allFilmIds = [...new Set(rows.flatMap((r) => r.list_films.map((x) => x.film_id)))];
  const [people, counts, filmRows] = await Promise.all([
    members((cols) => db.from("member_profiles").select(cols).in("id", owners)),
    db.from("list_save_counts").select("list_id, saves").in("list_id", ids),
    (async () => {
      // Only published films, in chunks so the request URL stays short. The chunks are asked for
      // together: they used to go one after another, so a page with 1,000 films waited five times.
      type FilmRow = { id: string; slug: string; title: string; year: number; poster_url: string | null; color?: string | null };
      const chunks = Array.from({ length: Math.ceil(allFilmIds.length / 200) }, (_, i) => allFilmIds.slice(i * 200, i * 200 + 200));
      const pages = await Promise.all(chunks.map(async (chunk) => {
        const { data, error } = await db.from("films").select("id, slug, title, year, poster_url, color").eq("status", "published").in("id", chunk);
        // A failed batch fails the page (the last good copy stays on screen) rather than quietly dropping its films.
        if (error) throw error;
        return (data ?? []) as FilmRow[];
      }));
      return pages.flat();
    })(),
  ]);
  const filmById = new Map(filmRows.map((f) => [f.id, f]));
  const ownerById = new Map(((people ?? []) as unknown as Member[]).map((p) => [p.id, p]));
  const savesById = new Map(((counts.data ?? []) as { list_id: string; saves: number }[]).map((c) => [c.list_id, c.saves]));
  const sorted = rows.map((r) => {
    const films = r.list_films.filter((x) => filmById.has(x.film_id))
      .sort((a, b) => r.staff_pick ? (filmById.get(a.film_id)!.year - filmById.get(b.film_id)!.year) : b.added_at.localeCompare(a.added_at));
    return { r, films };
  }).filter(({ r, films }) => ownerById.has(r.user_id) && (r.staff_pick || films.length >= MIN_FILMS));
  // Directors for the three posters shown on each tile.
  const shown = [...new Set(sorted.flatMap(({ films }) => films.slice(0, 3).map((x) => x.film_id)))];
  const directorsByFilm = new Map<string, { name: string }[]>();
  if (shown.length) {
    const { data: credits } = await db.from("credits").select("film_id, sort, people(name, in_directory)").eq("role", "director").in("film_id", shown).order("sort");
    for (const c of (credits ?? []) as unknown as { film_id: string; people: { name: string } | null }[])
      if (c.people) directorsByFilm.set(c.film_id, [...(directorsByFilm.get(c.film_id) ?? []), { name: c.people.name }]);
  }
  return sorted.map(({ r, films }) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    staff_pick: !!r.staff_pick,
    featured: !!r.staff_pick || !!r.featured,
    created_at: r.created_at,
    updated_at: [r.updated_at ?? r.created_at, ...r.list_films.map((x) => x.added_at)].sort().at(-1)!,
    saves: savesById.get(r.id) ?? 0,
    owner: ownerById.get(r.user_id) ? { handle: ownerById.get(r.user_id)!.handle } : null,
    filmSlugs: films.map((x) => filmById.get(x.film_id)!.slug),
    filmCount: films.length,
    films: films.slice(0, 3).map((x) => ({ id: x.film_id, title: filmById.get(x.film_id)!.title, year: filmById.get(x.film_id)!.year, poster_url: filmById.get(x.film_id)!.poster_url, color: filmById.get(x.film_id)!.color, directors: directorsByFilm.get(x.film_id) ?? [] })),
  }));
}, ["watchlist-tiles-v1"], { revalidate: 120, tags: ["watchlists"] });
