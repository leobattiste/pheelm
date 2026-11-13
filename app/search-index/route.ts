import { getCommunityCollections } from "@/lib/community";
import { getDirectors, getFilms } from "@/lib/data";
import { countryName, ROLE_LABELS } from "@/lib/format";
import type { Role } from "@/lib/types";

export const revalidate = 3600; // admin saves refresh it right away

/**
 * A compact index of every film, director, cast and crew member and collection, loaded the
 * first time someone opens search.
 */
export async function GET() {
  const [films, directors, collections] = await Promise.all([getFilms(), getDirectors(), getCommunityCollections()]);
  const directorIds = new Set(directors.map((d) => d.id));

  // Cast and crew who aren't directors here, with what they did and how many films.
  const people = new Map<string, { s: string; n: string; r: Set<string>; f: Set<string>; p: string | null }>();
  for (const f of films) {
    for (const c of f.credits) {
      if (directorIds.has(c.person.id)) continue;
      const entry = people.get(c.person.id) ?? { s: c.person.slug, n: c.person.name, r: new Set(), f: new Set(), p: c.person.photo_url };
      entry.r.add(c.role === "cast" ? "Actor" : ROLE_LABELS[c.role as Role]);
      entry.f.add(f.id);
      people.set(c.person.id, entry);
    }
  }

  return Response.json({
    films: films.map((f) => ({
      s: f.slug,
      t: f.title,
      o: [f.original_title, ...(f.aka ?? [])].filter((t) => t && t !== f.title).join(" ") || null,
      y: f.year,
      d: f.directors.map((d) => d.name),
      // Names of the cast and crew, so a film turns up when you search for someone in it.
      k: f.credits.filter((c) => c.role !== "director").slice(0, 16).map((c) => c.person.name),
      p: f.poster_url,
      // Countries and genres, so a search like "nigerian comedies" can filter.
      c: f.countries,
      g: f.genres,
    })),
    directors: directors.map((d) => ({
      s: d.slug,
      n: d.name,
      c: d.country ? countryName(d.country) : null,
      f: d.films.length,
      p: d.photo_url,
    })),
    people: [...people.values()].map((p) => ({ s: p.s, n: p.n, r: [...p.r].join(", "), f: p.f.size, p: p.p })),
    collections: collections.map((c) => ({ s: c.id, slug: c.slug, t: c.title, n: c.films.length })),
  });
}
