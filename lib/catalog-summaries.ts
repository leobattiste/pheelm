import { unstable_cache } from "next/cache";
import { getDirectors, getFilms, toDirectorSummary } from "./data";
import { countryName } from "./format";

/**
 * Small results worked out from the whole catalogue and kept in the shared cache for an hour (or
 * until an admin save clears the tag), so signed-in pages like /me and /welcome don't each read
 * the whole catalogue on a fresh server.
 */
export const CATALOG_SUMMARIES = "catalog-summaries";

/** Every director as a card, for "Directors you follow". */
export const directorSummaries = unstable_cache(
  async () => (await getDirectors()).map(toDirectorSummary),
  ["director-summaries-v1"],
  { revalidate: 3600, tags: [CATALOG_SUMMARIES] },
);

/** The directors and films a new member is offered on /welcome. */
export const welcomePicks = unstable_cache(
  async () => {
    const [films, directors] = await Promise.all([getFilms(), getDirectors()]);
    // Directors with the most films on Pheelm, then essential films with posters.
    const people = [...directors]
      .sort((a, b) => Number(!!b.photo_url) - Number(!!a.photo_url) || b.films.length - a.films.length)
      .slice(0, 12)
      .map((d) => ({ id: d.id, name: d.name, place: d.country ? countryName(d.country) : null, photo: d.photo_url }));
    const picks = films
      .filter((f) => f.poster_url && (f.note || f.featured))
      .sort((a, b) => Number(!!b.note) - Number(!!a.note) || b.year - a.year)
      .slice(0, 12)
      .map((f) => ({ id: f.id, title: f.title, year: f.year, poster: f.poster_url, directors: f.directors.map((d) => d.name) }));
    return { people, films: picks };
  },
  ["welcome-picks-v1"],
  { revalidate: 3600, tags: [CATALOG_SUMMARIES] },
);
