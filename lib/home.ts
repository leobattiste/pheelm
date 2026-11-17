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
 * Intersect TMDB's worldwide popularity order with Pheelm's published catalog. Using TMDB IDs
 * avoids matching namesakes or remakes by title. Never substitute Pheelm watchlist activity,
 * awards or a random order when the external popularity chart is missing.
 */
export function popularHomeFilms(films: Film[], popularMovieIds: readonly number[], limit = 6): Film[] {
  const catalog = new Map(films.filter((film) => film.status === "published" && film.tmdb_id)
    .map((film) => [film.tmdb_id, film]));
  const ranked: Film[] = [];
  for (const id of new Set(popularMovieIds)) {
    const film = catalog.get(id);
    if (film) ranked.push(film);
  }
  return ranked.slice(0, Math.max(0, limit));
}

/** Assemble the homepage from existing catalog and publicly visible community data. */
export function buildHomeData(
  films: Film[],
  directors: Director[],
  collections: CommunityCollection[],
  now = new Date(),
  followedIds: ReadonlySet<string> = new Set(),
  popularMovieIds: readonly number[] = [],
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
    popularFilms: popularHomeFilms(published, popularMovieIds),
    featuredWatchlists: collections.filter((list) => list.featured || list.staff_pick).slice(0, 3),
    directorsToFollow: rotated.slice(0, 4),
  };
}
