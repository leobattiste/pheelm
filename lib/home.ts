import type { CommunityCollection } from "./community";
import type { Director, Film } from "./types";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const MONDAY = Date.UTC(2024, 0, 1);

/** A single selection for everyone throughout a Monday–Sunday week, in UTC. */
export function homeWeek(now = new Date()) {
  return Math.floor((now.getTime() - MONDAY) / WEEK);
}

function weekly<T>(items: T[], week: number): T | null {
  return items.length ? items[((week % items.length) + items.length) % items.length] : null;
}

/**
 * Rank only films present in public community watchlists. A watchlist contributes once per
 * film, regardless of duplicate rows or its follower count. No private saves or watched history
 * are read. The caller supplies getCommunityCollections() results, which enforce public access
 * and the community's visibility rules. With no public signal, return an honest empty state.
 */
export function popularHomeFilms(films: Film[], collections: CommunityCollection[], limit = 6): Film[] {
  const counts = new Map<string, number>();
  const seenLists = new Set<string>();
  for (const list of collections) {
    if (seenLists.has(list.id)) continue;
    seenLists.add(list.id);
    for (const id of new Set(list.films.map((film) => film.id))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return films.filter((film) => film.status === "published" && counts.has(film.id))
    .sort((a, b) => counts.get(b.id)! - counts.get(a.id)! || a.title.localeCompare(b.title, "en") || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}

/** Assemble the homepage from existing catalog and publicly visible community data. */
export function buildHomeData(
  films: Film[],
  directors: Director[],
  collections: CommunityCollection[],
  now = new Date(),
  followedIds: ReadonlySet<string> = new Set(),
) {
  const week = homeWeek(now);
  const published = films.filter((film) => film.status === "published");
  const featured = published.filter((film) => film.featured);
  const curated = featured.length ? featured : published.filter((film) => film.note?.trim());
  const filmPool = curated.length ? curated : published;
  // Prefer a cinematic still when available, without excluding the rest of a curated selection.
  const illustrated = filmPool.filter((film) => film.backdrop_url);
  const filmOfWeek = weekly([...(illustrated.length ? illustrated : filmPool)]
    .sort((a, b) => a.slug.localeCompare(b.slug)), week);

  const eligible = directors.filter((director) => director.in_directory !== false && director.films.some((film) => film.status === "published"));
  const complete = eligible.filter((director) => director.photo_url && director.bio?.trim());
  const directorOfWeek = weekly([...(complete.length ? complete : eligible)]
    .sort((a, b) => a.slug.localeCompare(b.slug)), week);

  const suggestions = eligible.filter((director) => director.id !== directorOfWeek?.id && !followedIds.has(director.id))
    .sort((a, b) => Number(!!b.photo_url) - Number(!!a.photo_url) || a.slug.localeCompare(b.slug));
  // Rotate the suggestions weekly too, so the same alphabetic names don't always lead.
  const start = suggestions.length ? ((week % suggestions.length) + suggestions.length) % suggestions.length : 0;
  const rotated = [...suggestions.slice(start), ...suggestions.slice(0, start)];

  return {
    filmOfWeek,
    directorOfWeek,
    popularFilms: popularHomeFilms(published, collections),
    featuredWatchlists: collections.filter((list) => list.featured || list.staff_pick).slice(0, 3),
    directorsToFollow: rotated.slice(0, 4),
  };
}
