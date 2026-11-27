/**
 * What an edit changed, field by field, for the activity log: "Synopsis: (empty) → A novelist…".
 * Values are shortened so a log line stays small; lists and long text become a short summary.
 */
export type Change = { field: string; before: string; after: string };

const MAX = 140;
const clip = (s: string) => (s.length > MAX ? s.slice(0, MAX - 1) + "…" : s);

/** A value as a person would read it. */
export function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    if (value.every((v) => typeof v === "string" || typeof v === "number")) return clip(value.join(", "));
    return `${value.length} ${value.length === 1 ? "entry" : "entries"}`;
  }
  if (typeof value === "object") return clip(JSON.stringify(value));
  return clip(String(value).replace(/\s+/g, " ").trim());
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  || ((a === null || a === undefined || a === "") && (b === null || b === undefined || b === ""));

/** The fields that differ between two versions of a record, labelled. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>, labels: Record<string, string>): Change[] {
  const out: Change[] = [];
  for (const [key, field] of Object.entries(labels)) {
    if (!(key in after)) continue;
    if (same(before[key], after[key])) continue;
    out.push({ field, before: show(before[key]), after: show(after[key]) });
  }
  return out;
}

/** Who was added to and taken off a list of names (credits, say), as one change. */
export function listChange(field: string, before: string[], after: string[]): Change | null {
  const added = after.filter((x) => !before.includes(x));
  const removed = before.filter((x) => !after.includes(x));
  if (!added.length && !removed.length) {
    return before.join("\n") === after.join("\n") ? null : { field, before: `${before.length} lines`, after: "Same people, new order" };
  }
  const parts = [...added.map((x) => `+ ${x}`), ...removed.map((x) => `− ${x}`)];
  return { field, before: `${before.length} lines`, after: clip(`${after.length} lines (${parts.join(", ")})`) };
}

export const FILM_FIELDS: Record<string, string> = {
  title: "Title", original_title: "Original title", slug: "Address", year: "Year", type: "Type", status: "Status",
  featured: "Featured", runtime: "Runtime", countries: "Countries", languages: "Languages", genres: "Genres",
  aka: "Also known as", note: "Why it matters", synopsis: "Synopsis", poster_url: "Poster", color: "Page colour",
  backdrop_url: "Still", trailer_url: "Trailer", tmdb_id: "TMDB id", awards: "Awards", watch: "Where to watch",
};

export const PERSON_FIELDS: Record<string, string> = {
  name: "Name", slug: "Address", country: "Country", birth_year: "Birth year", tmdb_id: "TMDB id",
  bio: "Biography", photo_url: "Portrait", in_directory: "Shown in the directory",
};
