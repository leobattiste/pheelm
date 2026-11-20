import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import local from "@/data/catalog.json";
import { decadeOf } from "./format";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./supabase/config";
import type {
  Collection, CollectionRow, CreditRow, Director, DirectorSummary, Film, FilmCard, FilmRow, PersonRow,
} from "./types";

type Raw = {
  films: FilmRow[];
  people: PersonRow[];
  credits: CreditRow[];
  collections: CollectionRow[];
  collection_films: { collection_id: string; film_id: string; sort: number }[];
};

/**
 * Supabase returns at most 1,000 rows per request, so read big tables in pages.
 *
 * The pages used to be asked for all at once. With 31,000 credits that is thirty-one sorts of the
 * whole table arriving together, and the database answered with "canceling statement due to
 * statement timeout" — which, since a build now stops rather than shipping a half-read catalog,
 * failed the deploy. They go a few at a time instead: barely slower in wall-clock, and the
 * database is never asked for the whole table thirty times over.
 */
// A fixed order keeps pages from overlapping or skipping rows.
const ORDER: Record<string, string[]> = { credits: ["film_id", "person_id", "role"], collection_films: ["collection_id", "film_id"] };

/**
 * At most this many catalog requests are in flight at once, counted across every table rather
 * than per table: the five tables are read together, so a per-table limit of four would still
 * have put twenty sorts of large tables on the database at the same time.
 */
const AT_ONCE = 4;
let active = 0;
const waiting: (() => void)[] = [];
async function withSlot<T>(run: () => PromiseLike<T>): Promise<T> {
  if (active >= AT_ONCE) await new Promise<void>((free) => waiting.push(free));
  else active++;
  try {
    return await run();
  } finally {
    // The slot passes straight to whoever is next, so the count can never drift upward.
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

async function readAll<T>(db: SupabaseClient, table: string, filter?: (q: any) => any): Promise<T[]> {
  const page = (from: number, count = false) => withSlot(() => {
    let q = db.from(table).select("*", count ? { count: "exact" } : undefined);
    for (const column of ORDER[table] ?? ["id"]) q = q.order(column);
    q = q.range(from, from + 999);
    if (filter) q = filter(q);
    return q;
  });
  const first = await page(0, true);
  if (first.error) throw new Error(`Could not load ${table} from Supabase: ${first.error.message}`);
  const total = first.count ?? first.data?.length ?? 0;
  const pages = Math.max(0, Math.ceil(total / 1000) - 1);
  const rest = await Promise.all(Array.from({ length: pages }, (_, i) => page((i + 1) * 1000)));
  const out = [...(first.data as T[])];
  for (const r of rest) {
    if (r.error) throw new Error(`Could not load ${table} from Supabase: ${r.error.message}`);
    out.push(...(r.data as T[]));
  }
  return out;
}

/**
 * Loads the whole published catalog. Thousands of films still fit in memory, but downloading it
 * for every page doesn't: during a build that's hundreds of copies at once. So one copy is shared
 * by every page this server process renders, refreshed after a minute.
 */
const FRESH_FOR = 60_000;
/**
 * How long one copy serves. Nothing in the catalog changes while the site is building, and a build
 * takes several minutes, so refreshing every minute meant reading all 31,000 credits and 19,000
 * people four or five times for one deploy. During a build the first copy serves the whole of it.
 */
const freshFor = () => (building() ? Infinity : FRESH_FOR);
let shared: { at: number; data: Promise<Raw> } | null = null;
const load = cache((): Promise<Raw> => {
  if (!supabaseEnabled) return Promise.resolve(local as unknown as Raw);
  if (shared && Date.now() - shared.at < freshFor()) return shared.data;
  const data = fetchCatalog();
  shared = { at: Date.now(), data };
  // A failed download isn't kept, so the next page tries again.
  data.catch(() => { if (shared?.data === data) shared = null; });
  return data;
});

async function fetchCatalog(): Promise<Raw> {
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  try {
    const [films, people, credits, collections, collection_films] = await Promise.all([
      readAll<FilmRow>(db, "films", (q) => q.eq("status", "published")),
      readAll<PersonRow>(db, "people"),
      readAll<CreditRow>(db, "credits"),
      readAll<CollectionRow>(db, "collections"),
      readAll<Raw["collection_films"][number]>(db, "collection_films"),
    ]);
    if (!films.length) {
      // An empty catalog is a setup step locally and a broken deploy in production.
      if (building()) throw new Error("Supabase returned no published films. Check the keys, and that supabase/schema.sql and seed.sql have run.");
      console.warn("⚠ Supabase has no published films yet, so the starter catalog is shown. Run supabase/seed.sql.");
      return local as unknown as Raw;
    }
    return { films, people, credits, collections, collection_films };
  } catch (e) {
    // A build that can't reach the database must stop. It used to fall back to the starter
    // catalog, which quietly published a site of 74 films with no posters; Vercel keeps serving
    // the previous deploy instead, which is what a failed build should leave behind.
    if (building()) {
      console.error(`⚠ Build stopped: ${e instanceof Error ? e.message : e}\n  Check the Supabase keys and that supabase/schema.sql and seed.sql have run.`);
    }
    // On the live site, failing keeps the last good version of the page on screen.
    throw e;
  }
}

/** True while Next is building the production site, when a half-built catalog must not ship. */
export const building = () => process.env.NEXT_PHASE === "phase-production-build";

const byTitle = (a: { title: string }, b: { title: string }) =>
  a.title.replace(/^(the|a|an) /i, "").localeCompare(b.title.replace(/^(the|a|an) /i, ""), "en", { sensitivity: "base" });

let built: { raw: Raw; data: ReturnType<typeof buildCatalog> } | null = null;
const catalog = cache(async () => {
  const raw = await load();
  if (built?.raw !== raw) built = { raw, data: buildCatalog(raw) };
  return built.data;
});

function buildCatalog(raw: Raw) {
  const personById = new Map(raw.people.map((p) => [p.id, p]));
  const collectionById = new Map(raw.collections.map((c) => [c.id, c]));

  const creditsByFilm = new Map<string, CreditRow[]>();
  for (const c of raw.credits) {
    const list = creditsByFilm.get(c.film_id) ?? [];
    list.push(c);
    creditsByFilm.set(c.film_id, list);
  }
  const collectionsByFilm = new Map<string, CollectionRow[]>();
  for (const cf of raw.collection_films) {
    const c = collectionById.get(cf.collection_id);
    if (!c) continue;
    const list = collectionsByFilm.get(cf.film_id) ?? [];
    list.push(c);
    collectionsByFilm.set(cf.film_id, list);
  }

  const films: Film[] = raw.films
    .map((f) => {
      const credits = (creditsByFilm.get(f.id) ?? [])
        .sort((a, b) => a.sort - b.sort)
        .flatMap((c) => {
          const person = personById.get(c.person_id);
          return person ? [{ person, role: c.role, character: c.character }] : [];
        });
      return {
        ...f,
        awards: f.awards ?? [],
        watch: f.watch ?? [],
        credits,
        directors: credits.filter((c) => c.role === "director").map((c) => c.person),
        collections: (collectionsByFilm.get(f.id) ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((c) => ({ slug: c.slug, title: c.title })),
      };
    })
    .sort((a, b) => b.year - a.year || byTitle(a, b));

  const filmById = new Map(films.map((f) => [f.id, f]));

  // A director is anyone with a directing credit on a published film, except co-directors kept
  // out of the directory (they stay in the film's credits and have a cast-and-crew page).
  const directorFilms = new Map<string, Film[]>();
  for (const f of films)
    for (const d of f.directors) if (d.in_directory !== false) directorFilms.set(d.id, [...(directorFilms.get(d.id) ?? []), f]);
  const directors: Director[] = [...directorFilms.entries()]
    .map(([id, list]) => ({ ...personById.get(id)!, films: list.sort((a, b) => b.year - a.year) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  const collections: Collection[] = raw.collections
    .map((c) => ({
      ...c,
      films: raw.collection_films
        .filter((cf) => cf.collection_id === c.id)
        .sort((a, b) => a.sort - b.sort)
        .map((cf) => filmById.get(cf.film_id))
        .filter((f): f is Film => Boolean(f)),
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

  return { films, filmById, directors, collections, people: raw.people };
}

/**
 * Rows whose column matches one of these ids, read in chunks of 200 so the request URL stays
 * short: PostgREST puts every id in the query string, and a few thousand of them overflow it.
 */
async function readIn<T>(db: SupabaseClient, table: string, column: string, ids: string[]): Promise<T[]> {
  const unique = [...new Set(ids)];
  const chunks = Array.from({ length: Math.ceil(unique.length / 200) }, (_, i) => unique.slice(i * 200, i * 200 + 200));
  const pages = await Promise.all(chunks.map((chunk) => readAll<T>(db, table, (q) => q.in(column, chunk))));
  return pages.flat();
}

/**
 * Everything one film page needs, and nothing else.
 *
 * The page used to load the whole catalogue — every film, and all ~29,000 cast and crew rows with
 * their ~20,000 people — to show one film. Past 2,000 films a cold render ran past the time limit
 * and visitors got an error page. It now reads the film itself in full, every film's director
 * credits (which the cards, "more by" and "more like this" need), and the credits of just this
 * film's people, so their filmographies still fill the cast sheets.
 *
 * It returns the same shapes `catalog()` does, so the page's own code is unchanged. Without
 * Supabase — local work and CI — it falls back to the starter catalogue.
 */
export const filmPageCatalog = cache(async (slug: string) => {
  // A build prerenders many film pages at once. There the whole catalog is read once and shared by
  // all of them, which is less work than a trimmed read per page; the saving is for a live visit,
  // where one page renders on its own. Local work and CI have no Supabase, and take this path too.
  if (!supabaseEnabled || building()) {
    const c = await catalog();
    return { film: c.films.find((f) => f.slug === slug) ?? null, films: c.films, directors: c.directors };
  }
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const [films, directorCredits, collections, collectionFilms] = await Promise.all([
    readAll<FilmRow>(db, "films", (q) => q.eq("status", "published")),
    readAll<CreditRow>(db, "credits", (q) => q.eq("role", "director")),
    readAll<CollectionRow>(db, "collections"),
    readAll<Raw["collection_films"][number]>(db, "collection_films"),
  ]);
  const film = films.find((f) => f.slug === slug);
  if (!film) return { film: null, films: [], directors: [] };

  // This film in full, then the other credits of the people on it, for their filmographies.
  const own = await readAll<CreditRow>(db, "credits", (q) => q.eq("film_id", film.id));
  const theirs = await readIn<CreditRow>(db, "credits", "person_id", own.map((c) => c.person_id));
  const seen = new Set<string>();
  const unique = [...directorCredits, ...own, ...theirs].filter((c) => {
    const key = `${c.film_id}:${c.person_id}:${c.role}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
  const people = await readIn<PersonRow>(db, "people", "id", unique.map((c) => c.person_id));

  const { films: built, directors } = buildCatalog({ films, people, credits: unique, collections, collection_films: collectionFilms });
  return { film: built.find((f) => f.slug === slug) ?? null, films: built, directors };
});

export async function getFilms() {
  return (await catalog()).films;
}

export async function getFilm(slug: string) {
  return (await catalog()).films.find((f) => f.slug === slug) ?? null;
}

export async function getDirectors() {
  return (await catalog()).directors;
}

export async function getDirector(slug: string) {
  return (await catalog()).directors.find((d) => d.slug === slug) ?? null;
}

/** Any person, with every film they worked on, for cast and crew pages. */
export async function getPerson(slug: string) {
  const { films, people } = await catalog();
  const person = people.find((p) => p.slug === slug);
  if (!person) return null;
  const work = films.flatMap((f) =>
    f.credits.filter((c) => c.person.id === person.id).map((c) => ({ film: f, role: c.role, character: c.character })),
  );
  return work.length ? { person, work } : null;
}

export async function getCollections() {
  return (await catalog()).collections.filter((c) => c.films.length);
}

export async function getCollection(slug: string) {
  return (await catalog()).collections.find((c) => c.slug === slug) ?? null;
}

const wins = (f: Film) => f.awards.filter((a) => a.result === "won").length;

export function toDirectorSummary(d: Director): DirectorSummary {
  const years = d.films.map((f) => f.year);
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    country: d.country,
    photo_url: d.photo_url,
    films: d.films.length,
    first: Math.min(...years),
    last: Math.max(...years),
    previews: [...d.films]
      .sort((a, b) => Number(!!b.poster_url) - Number(!!a.poster_url) || wins(b) - wins(a) || b.year - a.year)
      .slice(0, 3)
      .map((f) => ({ slug: f.slug, title: f.title, year: f.year, poster_url: f.poster_url, color: f.color ?? null, directors: f.directors.map((p) => p.name) })),
  };
}

export function toCard(f: Film): FilmCard {
  return {
    id: f.id, slug: f.slug, title: f.title, year: f.year, type: f.type, countries: f.countries,
    languages: f.languages, genres: f.genres, poster_url: f.poster_url, color: f.color ?? null, runtime: f.runtime ?? null,
    directors: f.directors.map((d) => d.name),
    also: [f.original_title, ...(f.aka ?? [])].filter((t) => t && t !== f.title).join(" ") || undefined,
    wins: f.awards.filter((a) => a.result === "won").length,
  };
}

/** Counts used by the filters and the browse-by sections. */
export async function getFacets() {
  const films = await getFilms();
  const tally = (values: string[]) => {
    const m = new Map<string, number>();
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  return {
    countries: tally(films.flatMap((f) => f.countries)),
    decades: tally(films.map((f) => decadeOf(f.year))).sort((a, b) => a[0].localeCompare(b[0])),
    languages: tally(films.flatMap((f) => f.languages)),
    genres: tally(films.flatMap((f) => f.genres)),
  };
}
