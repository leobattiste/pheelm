import "server-only";

import type { Award } from "./types";

/**
 * Awards and nominations from Wikidata, matched by the film's TMDB id (Wikidata property P4947).
 * TMDB itself has no awards data. A film's awards come from two places on Wikidata: awards given
 * to the film, and awards given to a person "for work" on the film (an actor's Oscar, say).
 */
const ENDPOINT = "https://query.wikidata.org/sparql";
const HEADERS = { Accept: "application/sparql-results+json", "User-Agent": "Pheelm/1.0 (https://pheelm.com; awards for the film directory)" };

const query = (tmdbId: number) => `SELECT ?kind ?awardLabel ?byLabel ?personLabel ?time ?eventTime WHERE {
  ?film wdt:P4947 "${tmdbId}".
  { ?film p:P166 ?st. ?st ps:P166 ?award. BIND("won" AS ?kind) }
  UNION { ?film p:P1411 ?st. ?st ps:P1411 ?award. BIND("nominated" AS ?kind) }
  UNION { ?person p:P166 ?st. ?st ps:P166 ?award; pq:P1686 ?film. BIND("won" AS ?kind) }
  UNION { ?person p:P1411 ?st. ?st ps:P1411 ?award; pq:P1686 ?film. BIND("nominated" AS ?kind) }
  OPTIONAL { ?st pq:P585 ?time }
  OPTIONAL { ?st pq:P805 ?event. ?event wdt:P585 ?eventTime }
  OPTIONAL { ?award wdt:P1027 ?by }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 400`;

export type WikidataRow = { kind: string; award: string; by?: string; person?: string; time?: string; eventTime?: string };

// Award families written the way the film page and its ordering expect.
const FAMILIES: [RegExp, string][] = [
  [/^Academy Award\b/i, "Academy Awards"],
  [/^(BAFTA|British Academy Film) Award\b/i, "BAFTA Awards"],
  [/^Golden Globe Award\b/i, "Golden Globe Awards"],
  [/^César Award\b/i, "César Awards"],
  [/^Independent Spirit Award\b/i, "Independent Spirit Awards"],
  [/^NAACP Image Award\b/i, "NAACP Image Awards"],
  [/^Screen Actors Guild Award\b/i, "Screen Actors Guild Awards"],
  [/^Critics' Choice Movie Award\b/i, "Critics' Choice Awards"],
  [/^Primetime Emmy Award\b/i, "Primetime Emmy Awards"],
  [/^Africa Movie Academy Award\b/i, "Africa Movie Academy Awards"],
];
const FESTIVALS: [RegExp, string][] = [
  [/Cannes/i, "Cannes Film Festival"], [/Berlin/i, "Berlin International Film Festival"], [/Venice/i, "Venice Film Festival"],
  [/Sundance/i, "Sundance Film Festival"], [/FESPACO|Panafrican Film and Television Festival/i, "FESPACO"], [/Toronto/i, "Toronto International Film Festival"],
];

/** Turns one Wikidata row into the directory's award shape, or null when it says nothing useful. */
export function toAward(row: WikidataRow, filmYear: number): Award | null {
  const label = row.award.trim();
  // Unlabelled items come back as their id (Q12345): nothing to show.
  if (!label || /^Q\d+$/.test(label)) return null;
  const when = row.time ?? row.eventTime;
  const year = when && /^\d{4}/.test(when) ? Number(when.slice(0, 4)) : filmYear;
  let award = label, category = "";
  const family = FAMILIES.find(([re]) => re.test(label));
  const split = label.match(/^(.+?) (?:Award|Prize|Awards) for (.+)$/i);
  if (/^National Film Registry$/i.test(label)) award = "National Film Registry";
  else if (family) { award = family[1]; category = split ? split[2] : label.replace(family[0], "").trim(); }
  else {
    const by = row.by && !/^Q\d+$/.test(row.by) ? row.by : "";
    const festival = FESTIVALS.find(([re]) => re.test(by) || re.test(label));
    if (festival) { award = festival[1]; category = label === festival[1] ? "" : label; }
    else if (split) { award = split[1] + " Awards"; category = split[2]; }
    else if (by) { award = by; category = label; }
  }
  category = category.charAt(0).toUpperCase() + category.slice(1);
  if (row.person && !/^Q\d+$/.test(row.person)) category = category ? `${category}: ${row.person}` : row.person;
  return { award, category, result: row.kind === "won" ? "won" : "nominated", year };
}

/** One entry per award, category and year; a win replaces the nomination it came from. */
export function mergeAwards(list: Award[]): Award[] {
  const byKey = new Map<string, Award>();
  for (const a of list) {
    const key = [a.award, a.category, a.year].join("|").toLowerCase();
    const seen = byKey.get(key);
    if (!seen || (seen.result === "nominated" && a.result === "won")) byKey.set(key, a);
  }
  return [...byKey.values()].sort((a, b) => a.year - b.year || a.award.localeCompare(b.award));
}

/** The film's awards from Wikidata; null if Wikidata could not be reached (try again later). */
export async function wikidataAwards(tmdbId: number, filmYear: number): Promise<Award[] | null> {
  try {
    const res = await fetch(ENDPOINT + "?format=json&query=" + encodeURIComponent(query(tmdbId)), { headers: HEADERS, signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json() as { results?: { bindings?: Record<string, { value: string }>[] } };
    const rows = (json.results?.bindings ?? []).map((b) => ({
      kind: b.kind?.value ?? "", award: b.awardLabel?.value ?? "", by: b.byLabel?.value, person: b.personLabel?.value, time: b.time?.value, eventTime: b.eventTime?.value,
    }));
    return mergeAwards(rows.flatMap((r) => toAward(r, filmYear) ?? []));
  } catch {
    return null;
  }
}

/**
 * Replaces a film's awards with Wikidata's when Wikidata has any. National Film Registry entries
 * and everything else are kept when Wikidata has nothing, so hand-entered awards aren't lost.
 */
export function withWikidata(existing: Award[], fresh: Award[] | null): Award[] | null {
  if (!fresh || !fresh.length) return null;
  const registry = existing.filter((a) => a.award === "National Film Registry");
  return mergeAwards([...fresh, ...registry]);
}
