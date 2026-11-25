import { slugify } from "./format";

/** A film's address: /films/touki-bouki/by/djibril-diop-mambety (the first director; just the film when there is none). */
export function filmPath(slug: string, directors?: (string | { name: string })[]) {
  const first = directors?.[0];
  const name = typeof first === "string" ? first : first?.name;
  const by = name ? slugify(name) : "";
  return by ? `/films/${slug}/by/${by}` : `/films/${slug}`;
}
