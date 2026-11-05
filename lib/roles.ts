import { listJoin } from "./format";
import type { Credit, Film, PersonRow } from "./types";

/** What someone did, from their credit. Shared roles read as co-director and co-writer. */
export function roleLabel(c: Pick<Credit, "role" | "character">, sharedBy: number) {
  const job = c.character?.toLowerCase() ?? "";
  switch (c.role) {
    case "director":
      return job === "co-director" || sharedBy > 1 ? "Co-director" : "Director";
    case "writer":
      if (job === "screenplay") return sharedBy > 1 ? "Co-writer" : "Screenplay";
      if (job === "story") return "Story";
      return sharedBy > 1 ? "Co-writer" : "Writer";
    case "cinematographer":
      return "Cinematographer";
    case "editor":
      return "Editor";
    case "composer":
      return "Composer";
    case "producer":
      return "Producer";
    default:
      return "Actor";
  }
}

/** "Director", "Director and actor", "Director, writer and actor". */
export function sentence(roles: string[]) {
  if (!roles.length) return "";
  const [first, ...rest] = roles;
  return listJoin([first, ...rest.map((r) => r.toLowerCase())]);
}

/** Everything one person did on one film, as a phrase. */
export function rolesOnFilm(film: Film, personId: string) {
  const counts = new Map<string, number>();
  for (const c of film.credits) counts.set(c.role, (counts.get(c.role) ?? 0) + 1);
  const labels: string[] = [];
  for (const c of film.credits) {
    if (c.person.id !== personId) continue;
    const l = roleLabel(c, counts.get(c.role) ?? 1);
    if (!labels.includes(l)) labels.push(l);
  }
  return sentence(labels);
}

/** A person's work on Pheelm, newest first, with what they did on each film. */
export function worksOf(personId: string, films: Film[]) {
  return films
    .filter((f) => f.credits.some((c) => c.person.id === personId))
    .sort((a, b) => b.year - a.year)
    .map((f) => ({ slug: f.slug, title: f.title, year: f.year, role: rolesOnFilm(f, personId) }));
}

export type Work = ReturnType<typeof worksOf>[number];

/** What a person is, across all their films: "Director, writer and actor". Most frequent first. */
export function overallRoles(works: Work[]) {
  const tally = new Map<string, number>();
  for (const w of works) for (const part of w.role.split(/, | and /)) {
    const r = part.charAt(0).toUpperCase() + part.slice(1);
    tally.set(r, (tally.get(r) ?? 0) + 1);
  }
  return sentence([...tally.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r));
}

/** What a person card or sheet needs, small enough to send to the browser. */
export type PersonInfo = {
  id: string;
  slug: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  born: string | null;
  died: string | null;
  birth_year: number | null;
  birthplace: string | null;
  imdb_id: string | null;
  instagram: string | null;
  isDirector: boolean;
  works: Work[];
};

export function personInfo(p: PersonRow, films: Film[], directorIds: Set<string>): PersonInfo {
  return {
    id: p.id, slug: p.slug, name: p.name, photo_url: p.photo_url, bio: p.bio,
    born: p.born ?? null, died: p.died ?? null, birth_year: p.birth_year ?? null, birthplace: p.birthplace ?? null,
    imdb_id: p.imdb_id ?? null, instagram: p.instagram ?? null,
    isDirector: directorIds.has(p.id),
    works: worksOf(p.id, films),
  };
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** When and where someone was born: "20 March 1957, Atlanta, Georgia, USA". Null when unknown. */
export function bornText(p: Pick<PersonInfo, "born" | "birth_year" | "birthplace">) {
  const when = p.born ? DATE.format(new Date(p.born)) : p.birth_year ? String(p.birth_year) : null;
  return [when, p.birthplace].filter(Boolean).join(", ") || null;
}

/** When someone died: "12 December 2019". Null for the living or unknown. */
export function diedText(p: Pick<PersonInfo, "died">) {
  return p.died ? DATE.format(new Date(p.died)) : null;
}
