import "server-only";
import { unstable_cache } from "next/cache";
import { getPopularMoviesPage, tmdbEnabled } from "./tmdb";

const MAX_PAGES = 20;
const CONCURRENCY = 4;

/**
 * One bounded global chart is shared by every Films page, rather than fetching every catalog
 * film's score. Store only public movie IDs, never credentials, sessions or member activity.
 * Keep TMDB order across pages; the Films page intersects this with its published catalog.
 * A sparse intersection can show fewer than six films without inventing a ranking.
 */
const readPopularMovieIds = unstable_cache(async (): Promise<number[]> => {
  // One deadline covers the entire refresh, including later batches, so a slow chart cannot
  // hold the Films page for six seconds per batch.
  const deadline = AbortSignal.timeout(6000);
  const first = await getPopularMoviesPage(1, deadline);
  if (!Array.isArray(first.results) || !Number.isInteger(first.total_pages) || first.total_pages < 1) {
    throw new Error("TMDB popularity data was incomplete.");
  }
  const rows = [...first.results];
  const last = Math.min(first.total_pages, MAX_PAGES);
  for (let start = 2; start <= last; start += CONCURRENCY) {
    const pages = await Promise.all(Array.from({ length: Math.min(CONCURRENCY, last - start + 1) }, (_, i) => getPopularMoviesPage(start + i, deadline)));
    for (const page of pages) {
      if (!Array.isArray(page.results)) throw new Error("TMDB popularity data was incomplete.");
      rows.push(...page.results);
    }
  }
  return [...new Set(rows.map((row) => row.id).filter((id) => Number.isSafeInteger(id) && id > 0))];
}, ["films-worldwide-tmdb-popularity-v1"], { revalidate: 6 * 60 * 60 });

/** Missing credentials or a chart outage leave an honest empty section, not local popularity. */
export async function getPopularMovieIds(): Promise<number[]> {
  if (!tmdbEnabled) return [];
  try {
    return await readPopularMovieIds();
  } catch {
    // Do not log the request URL: a short TMDB API key is included in its query string.
    return [];
  }
}

/** Keep the worldwide chart order; only published Pheelm films can open a film page. */
export function rankPopularFilms<T extends {status: string; tmdb_id: number | null}>(films: T[], ids: readonly number[], limit = 12): T[] {
  const byId = new Map(films.filter(f => f.status === "published" && f.tmdb_id).map(f => [f.tmdb_id, f]));
  return [...new Set(ids)].flatMap(id => { const film = byId.get(id); return film ? [film] : []; }).slice(0, limit);
}
