import { getDirectors, getFilms } from "@/lib/data";
import { countryName } from "@/lib/format";

export const revalidate = 300;

/** A compact list of every film and director, loaded the first time someone opens search. */
export async function GET() {
  const [films, directors] = await Promise.all([getFilms(), getDirectors()]);
  return Response.json({
    films: films.map((f) => ({
      s: f.slug,
      t: f.title,
      o: f.original_title,
      y: f.year,
      d: f.directors.map((d) => d.name),
      p: f.poster_url,
    })),
    directors: directors.map((d) => ({
      s: d.slug,
      n: d.name,
      c: d.country ? countryName(d.country) : null,
      f: d.films.length,
      p: d.photo_url,
    })),
  });
}
