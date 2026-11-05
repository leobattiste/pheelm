import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import local from "@/data/catalog.json";
import { decadeOf } from "./format";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./supabase/config";
import type {
  ArticleRow, Collection, CollectionRow, CreditRow, Director, DirectorSummary, Film, FilmCard, FilmRow, PersonRow,
} from "./types";

type Raw = {
  films: FilmRow[];
  people: PersonRow[];
  credits: CreditRow[];
  collections: CollectionRow[];
  collection_films: { collection_id: string; film_id: string; sort: number }[];
  articles: ArticleRow[];
};

/** Supabase returns at most 1,000 rows per request, so read big tables in pages. */
async function readAll<T>(db: SupabaseClient, table: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select("*").range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`Could not load ${table} from Supabase: ${error.message}`);
    out.push(...(data as T[]));
    if (!data || data.length < 1000) return out;
  }
}

/** Loads the whole published catalog once per render. Thousands of films still fit in memory. */
const load = cache(async (): Promise<Raw> => {
  if (!supabaseEnabled) return local as unknown as Raw;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  try {
    const [films, people, credits, collections, collection_films, articles] = await Promise.all([
      readAll<FilmRow>(db, "films", (q) => q.eq("status", "published")),
      readAll<PersonRow>(db, "people"),
      readAll<CreditRow>(db, "credits"),
      readAll<CollectionRow>(db, "collections"),
      readAll<Raw["collection_films"][number]>(db, "collection_films"),
      readAll<ArticleRow>(db, "articles", (q) => q.eq("status", "published")),
    ]);
    if (!films.length) {
      console.warn("⚠ Supabase has no published films yet, so the starter catalog is shown. Run supabase/seed.sql.");
      return local as unknown as Raw;
    }
    return { films, people, credits, collections, collection_films, articles };
  } catch (e) {
    // While building, a database problem shouldn't stop the deploy (Vercel would keep serving the
    // old version, without accounts). Build with the starter catalog and say why in the build log.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.error(`⚠ ${e instanceof Error ? e.message : e}\n  Building with the starter catalog. Check the Supabase keys and that supabase/schema.sql and seed.sql have run.`);
      return local as unknown as Raw;
    }
    // On the live site, failing keeps the last good version of the page on screen.
    throw e;
  }
});

const byTitle = (a: { title: string }, b: { title: string }) =>
  a.title.replace(/^(the|a|an) /i, "").localeCompare(b.title.replace(/^(the|a|an) /i, ""), "en", { sensitivity: "base" });

const catalog = cache(async () => {
  const raw = await load();
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

  // A director is anyone with a directing credit on a published film.
  const directorFilms = new Map<string, Film[]>();
  for (const f of films) for (const d of f.directors) directorFilms.set(d.id, [...(directorFilms.get(d.id) ?? []), f]);
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

  const articles = [...raw.articles].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));

  return { films, filmById, directors, collections, articles, people: raw.people };
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

export async function getArticles() {
  return (await catalog()).articles;
}

export async function getArticle(slug: string) {
  const { articles, filmById } = await catalog();
  const article = articles.find((a) => a.slug === slug);
  if (!article) return null;
  return { article, films: article.film_ids.map((id) => filmById.get(id)).filter((f): f is Film => Boolean(f)) };
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
