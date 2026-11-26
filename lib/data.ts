import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { cache } from "react";
import local from "@/data/catalog.json";
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

/**
 * A read that errors is tried again (up to three times, a moment apart) before it counts as
 * failed. One slow moment on the database (a 500 after a few seconds) used to fail a whole
 * deploy, because every page of the build depends on these reads.
 */
export const READ_TRIES = 3;
export const RETRY_WAIT_MS = 1_500;
async function readAll<T>(db: SupabaseClient, table: string, filter?: (q: any) => any): Promise<T[]> {
  const once = (from: number, count: boolean) => withSlot(() => {
    let q = db.from(table).select("*", count ? { count: "exact" } : undefined);
    for (const column of ORDER[table] ?? ["id"]) q = q.order(column);
    q = q.range(from, from + 999);
    if (filter) q = filter(q);
    return q;
  });
  const page = async (from: number, count = false) => {
    for (let attempt = 1; ; attempt++) {
      const result = await once(from, count);
      if (!result.error || attempt >= READ_TRIES) return result;
      await new Promise((wait) => setTimeout(wait, RETRY_WAIT_MS * attempt));
    }
  };
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
 * by every page this server process renders.
 *
 * It used to be thrown away after a minute. An admin save revalidates the whole site, so every
 * page then re-rendered, and every server re-read all 31,000 credits and 19,000 people (about 55
 * requests) once a minute: 1,000–2,000 people requests an hour, and thousands of "statement
 * timeout" errors on the database. Now, after a minute, the server asks for one row,
 * `catalog_version`, which triggers bump whenever films, people, credits or collections change, and
 * reads the catalog again only if that number moved. A copy is never kept past half an hour, and if
 * the version can't be read (the table isn't there yet) it falls back to the one-minute refresh.
 */
const CHECK_EVERY = 60_000;
const KEEP_AT_MOST = 30 * 60_000;
type Copy = { at: number; checked: number; version: number | null; data: Promise<Raw>; ready?: Raw };
let shared: Copy | null = null;
let checking: Promise<boolean> | null = null;

const anonClient = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

/**
 * Where the catalog comes from. Normally the snapshot: the whole published catalog as one
 * compressed file in Storage, rebuilt by /api/internal/catalog-snapshot when catalog_version moves.
 * One small row and one file download, where reading the tables page by page took about 55
 * requests per server and, with many servers starting at once, timed out on the database.
 *
 * Admin saves and the workers rebuild it right after a change (lib/catalog-snapshot.ts). Until the
 * new one lands — a few seconds — or if a rebuild fails, the snapshot is behind catalog_version and
 * the tables are read directly, so a change always shows straight away and nothing stays stale.
 */
type Source = { version: number | null; path: string | null };
async function catalogSource(db: SupabaseClient): Promise<Source> {
  const [live, snap] = await Promise.all([
    db.from("catalog_version").select("v").eq("id", 1).maybeSingle(),
    db.from("catalog_snapshot").select("version, path").eq("id", 1).maybeSingle(),
  ]);
  const v = live.error || !live.data ? null : Number(live.data.v);
  const snapshot = snap.error || !snap.data ? null : { version: Number(snap.data.version), path: String(snap.data.path) };
  if (snapshot && (v === null || snapshot.version >= v)) return snapshot;
  return { version: v, path: null };
}

/** The snapshot file, unpacked. */
async function readSnapshot(path: string): Promise<Raw> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/catalog/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load the catalog snapshot: ${res.status}`);
  const raw = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")) as Raw;
  if (!Array.isArray(raw.films) || !raw.films.length) throw new Error("The catalog snapshot is empty.");
  return raw;
}

/** The snapshot if there is a current one, else the tables page by page. */
function readCatalog(db: SupabaseClient, source: Source): Promise<Raw> {
  const tables = () => (building() ? sharedBuildCatalog(db) : fetchCatalog(db));
  if (!source.path) return tables();
  return readSnapshot(source.path).catch((e) => {
    console.warn(`⚠ ${e instanceof Error ? e.message : e}; reading the tables instead.`);
    return tables();
  });
}

/** True when the copy in memory is still the current catalog. One check at a time per server. */
function stillCurrent(copy: Copy): Promise<boolean> {
  if (copy.version === null) return Promise.resolve(false);
  checking ??= catalogSource(anonClient())
    .then((s) => s.version !== null && s.version === copy.version)
    .catch(() => false)
    .finally(() => { checking = null; });
  return checking;
}

function refresh(previous: Copy | null): Promise<Raw> {
  const at = Date.now();
  const db = anonClient();
  // The version is read before the rows: a change landing mid-download leaves the copy marked with
  // the older number, so the next check reads it again rather than missing the change.
  const source = catalogSource(db).catch((): Source => ({ version: null, path: null }));
  const data = source.then((src) => readCatalog(db, src));
  const copy: Copy = { at, checked: at, version: null, data };
  shared = copy;
  data.then(
    async (raw) => { copy.ready = raw; copy.version = (await source).version; },
    () => {
      // A failed download isn't kept. Outside a build, the last good copy carries on serving rather
      // than turning a busy database into error pages, and is checked again in a minute.
      if (shared !== copy) return;
      shared = previous?.ready && !building()
        ? { ...previous, at: Math.max(previous.at, Date.now() - KEEP_AT_MOST + CHECK_EVERY), checked: Date.now() }
        : null;
    },
  );
  return previous?.ready && !building() ? data.catch(() => previous.ready!) : data;
}

const load = cache(async (): Promise<Raw> => {
  if (!supabaseEnabled) return local as unknown as Raw;
  const copy = shared;
  // Nothing in the catalog changes while the site is building: one copy serves the whole build.
  if (copy && building()) return copy.data;
  const now = Date.now();
  if (copy && !copy.ready) return copy.data; // still downloading
  if (copy && now - copy.at < KEEP_AT_MOST) {
    if (now - copy.checked < CHECK_EVERY) return copy.data;
    if (await stillCurrent(copy)) {
      copy.checked = Date.now();
      return copy.data;
    }
    // Another page may have started the refresh while this one waited on the check.
    if (shared !== copy) return shared ? shared.data : refresh(copy);
  }
  return refresh(copy);
});

/** True when this server already holds a checked, current copy of the catalog. */
const warm = () => Boolean(shared?.ready && Date.now() - shared.checked < CHECK_EVERY);

/**
 * True when a current snapshot exists, so loading the whole catalog is one download and the
 * trimmed per-page reads below (a dozen requests each) aren't worth it. Asked once a minute.
 */
let snapshotCheck: { at: number; on: Promise<boolean> } | null = null;
const snapshotOn = () => {
  if (!snapshotCheck || Date.now() - snapshotCheck.at > CHECK_EVERY)
    snapshotCheck = { at: Date.now(), on: catalogSource(anonClient()).then((src) => Boolean(src.path), () => false) };
  return snapshotCheck.on;
};

/**
 * A build renders pages in several processes at once, and each used to download the whole
 * catalogue for itself: a burst of parallel reads that starved the database and timed out live
 * visitors' requests. Now the first process downloads it and leaves a copy in the temp folder;
 * the others wait for that copy and read it. One download per build.
 */
async function sharedBuildCatalog(db: SupabaseClient): Promise<Raw> {
  const key = (process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "local").replace(/[^\w-]/g, "");
  const file = join(tmpdir(), `pheelm-catalog-${key}.json`);
  const lock = `${file}.lock`;
  const FRESH = 15 * 60_000; // an older copy is from another build
  const readCopy = async () => {
    const info = await fs.stat(file).catch(() => null);
    if (!info || Date.now() - info.mtimeMs > FRESH) return null;
    return JSON.parse(await fs.readFile(file, "utf8")) as Raw;
  };
  for (let waited = 0; waited < 5 * 60_000; waited += 500) {
    const copy = await readCopy().catch(() => null);
    if (copy) return copy;
    const mine = await fs.open(lock, "wx").then((h) => h.close().then(() => true), () => false);
    if (mine) {
      try {
        const raw = await fetchCatalog(db);
        await fs.writeFile(`${file}.part`, JSON.stringify(raw));
        await fs.rename(`${file}.part`, file);
        return raw;
      } finally {
        await fs.rm(lock, { force: true });
      }
    }
    // Someone else is downloading. A lock left by a process that died is taken over after 3 minutes.
    const held = await fs.stat(lock).catch(() => null);
    if (held && Date.now() - held.mtimeMs > 3 * 60_000) await fs.rm(lock, { force: true });
    await new Promise((r) => setTimeout(r, 500));
  }
  return fetchCatalog(db);
}

export async function fetchCatalog(db: SupabaseClient): Promise<Raw> {
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
      if (building()) throw new Error("Supabase returned no published films. Check the keys, and that the baseline in supabase/migrations and supabase/seed.sql have run.");
      console.warn("⚠ Supabase has no published films yet, so the starter catalog is shown. Run supabase/seed.sql.");
      return local as unknown as Raw;
    }
    return { films, people, credits, collections, collection_films };
  } catch (e) {
    // A build that can't reach the database must stop. It used to fall back to the starter
    // catalog, which quietly published a site of 74 films with no posters; Vercel keeps serving
    // the previous deploy instead, which is what a failed build should leave behind.
    if (building()) {
      console.error(`⚠ Build stopped: ${e instanceof Error ? e.message : e}\n  Check the Supabase keys and that the baseline in supabase/migrations and supabase/seed.sql have run.`);
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
  // A server that already holds a current copy of the whole catalog uses it too: that costs
  // nothing, where the trimmed read is still a dozen requests.
  if (!supabaseEnabled || building() || warm() || (await snapshotOn())) {
    const c = await catalog();
    return { film: c.films.find((f) => f.slug === slug) ?? null, films: c.films, directors: c.directors };
  }
  const db = anonClient();
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

/**
 * Everything one person's page needs, and nothing else: the person, the films they worked on (with
 * all of each film's credits, for "what they did on it" and the directors on the cards) and the
 * people in those credits. About five short requests instead of the whole catalogue. A build, a
 * machine without Supabase and a server that already holds a current copy use that instead.
 */
export const personPageCatalog = cache(async (slug: string): Promise<{ person: PersonRow | null; director: Director | null; films: Film[] }> => {
  if (!supabaseEnabled || building() || warm() || (await snapshotOn())) {
    const c = await catalog();
    const person = c.people.find((p) => p.slug === slug) ?? null;
    return { person, director: c.directors.find((d) => d.slug === slug) ?? null, films: person ? c.films : [] };
  }
  const none = { person: null, director: null, films: [] };
  const db = anonClient();
  const [person] = await readAll<PersonRow>(db, "people", (q) => q.eq("slug", slug));
  if (!person) return none;
  const mine = await readAll<CreditRow>(db, "credits", (q) => q.eq("person_id", person.id));
  const ids = [...new Set(mine.map((c) => c.film_id))];
  if (!ids.length) return { ...none, person };
  const chunks = Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) => ids.slice(i * 200, i * 200 + 200));
  const [films, credits] = await Promise.all([
    Promise.all(chunks.map((chunk) => readAll<FilmRow>(db, "films", (q) => q.in("id", chunk).eq("status", "published")))).then((p) => p.flat()),
    readIn<CreditRow>(db, "credits", "film_id", ids),
  ]);
  if (!films.length) return { ...none, person };
  const people = await readIn<PersonRow>(db, "people", "id", [person.id, ...credits.map((c) => c.person_id)]);
  const built = buildCatalog({ films, people, credits, collections: [], collection_films: [] });
  return { person, director: built.directors.find((d) => d.id === person.id) ?? null, films: built.films };
});

/** A director page: the director and their films (see personPageCatalog). */
export const directorPageCatalog = cache(async (slug: string): Promise<{ director: Director | null; films: Film[] }> => {
  const { director, films } = await personPageCatalog(slug);
  return director ? { director, films } : { director: null, films: [] };
});

/** A cast or crew page: the person and every film they worked on, read the light way. */
export async function personPage(slug: string) {
  const { person, director, films } = await personPageCatalog(slug);
  if (!person) return null;
  const work = films.flatMap((f) =>
    f.credits.filter((c) => c.person.id === person.id).map((c) => ({ film: f, role: c.role, character: c.character })),
  );
  return work.length ? { person, work, director, films } : null;
}

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

function cardOf(f: FilmRow, directors: string[]): FilmCard {
  return {
    id: f.id, slug: f.slug, title: f.title, year: f.year, type: f.type, countries: f.countries,
    languages: f.languages, genres: f.genres, poster_url: f.poster_url, color: f.color ?? null, runtime: f.runtime ?? null,
    directors,
    also: [f.original_title, ...(f.aka ?? [])].filter((t) => t && t !== f.title).join(" ") || undefined,
    wins: (f.awards ?? []).filter((a) => a.result === "won").length,
  };
}

export function toCard(f: Film): FilmCard {
  return cardOf(f, f.directors.map((d) => d.name));
}

/**
 * Cards for just these films, such as the ones on one watchlist.
 *
 * A watchlist page needs a few dozen films and their directors. It used to load the whole catalogue
 * for that (about 55 requests, in parallel, on every visit), which is slow, and under load the
 * database answered with timeouts and the page wouldn't open. This reads only those films, their
 * director credits and those directors: three short requests. A server that already holds a current
 * copy of the catalogue, a build, and a machine without Supabase use that instead, which costs
 * nothing. Films that aren't published are left out, as before.
 */
export async function getFilmCards(ids: string[]): Promise<FilmCard[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  if (!supabaseEnabled || building() || warm() || (await snapshotOn())) {
    const { filmById } = await catalog();
    return unique.flatMap((id) => { const f = filmById.get(id); return f ? [toCard(f)] : []; });
  }
  const db = anonClient();
  const inChunks = <T,>(items: T[]) => Array.from({ length: Math.ceil(items.length / 200) }, (_, i) => items.slice(i * 200, i * 200 + 200));
  const films = (await Promise.all(inChunks(unique).map((chunk) =>
    readAll<FilmRow>(db, "films", (q) => q.in("id", chunk).eq("status", "published"))))).flat();
  if (!films.length) return [];
  const credits = (await Promise.all(inChunks(films.map((f) => f.id)).map((chunk) =>
    readAll<CreditRow>(db, "credits", (q) => q.in("film_id", chunk).eq("role", "director"))))).flat();
  const people = await readIn<PersonRow>(db, "people", "id", credits.map((c) => c.person_id));
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const directors = new Map<string, string[]>();
  for (const c of credits.sort((a, b) => a.sort - b.sort)) {
    const name = nameById.get(c.person_id);
    if (name) directors.set(c.film_id, [...(directors.get(c.film_id) ?? []), name]);
  }
  return films.map((f) => cardOf(f, directors.get(f.id) ?? []));
}
