import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getImdbId } from "./tmdb";
import type { Award } from "./types";

/**
 * Awards and nominations from Wikidata, matched by the film's TMDB id (Wikidata property P4947).
 * TMDB itself has no awards data. A film's awards come from two places on Wikidata: awards given
 * to the film, and awards given to a person "for work" on the film (an actor's Oscar, say).
 */
const ENDPOINT = "https://query.wikidata.org/sparql";
const HEADERS = { Accept: "application/sparql-results+json", "User-Agent": "Pheelm/1.0 (https://pheelm.com; awards for the film directory)" };

// A film is found by its TMDB id or, since many Wikidata films lack that, by its IMDb id.
// The query runs in the order written (hint:optimizer "None"): find the film first, then walk from
// it to the awards. Left to itself, Wikidata could start the per-person branches from every award
// statement on Wikidata and time out on films with long award lists — exactly the films that matter.
const query = (tmdbId: number, imdbId?: string | null) => `SELECT ?kind ?awardLabel ?byLabel ?personLabel ?time ?eventTime WHERE {
  hint:Query hint:optimizer "None".
  ${imdbId && /^tt\d+$/.test(imdbId) ? `{ ?film wdt:P4947 "${tmdbId}" } UNION { ?film wdt:P345 "${imdbId}" }` : `?film wdt:P4947 "${tmdbId}".`}
  { ?film p:P166 ?st. ?st ps:P166 ?award. BIND("won" AS ?kind) }
  UNION { ?film p:P1411 ?st. ?st ps:P1411 ?award. BIND("nominated" AS ?kind) }
  UNION { ?st pq:P1686 ?film. ?person p:P166 ?st. ?st ps:P166 ?award. BIND("won" AS ?kind) }
  UNION { ?st pq:P1686 ?film. ?person p:P1411 ?st. ?st ps:P1411 ?award. BIND("nominated" AS ?kind) }
  OPTIONAL { ?st pq:P585 ?time }
  OPTIONAL { ?st pq:P805 ?event. ?event wdt:P585 ?eventTime }
  OPTIONAL { ?award wdt:P1027 ?by }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 3000`;

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

type Entry = { award: string; base: string; person: string; result: "won" | "nominated"; year: number };

/** Turns one Wikidata row into the directory's award shape, or null when it says nothing useful. */
export function toAward(row: WikidataRow, filmYear: number): Award | null {
  const e = toEntry(row, filmYear);
  return e && { award: e.award, category: e.person ? (e.base ? `${e.base}: ${e.person}` : e.person) : e.base, result: e.result, year: e.year };
}

function toEntry(row: WikidataRow, filmYear: number): Entry | null {
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
  const person = row.person && !/^Q\d+$/.test(row.person) ? row.person : "";
  return { award, base: category, person, result: row.kind === "won" ? "won" : "nominated", year };
}

/**
 * Wikidata lists an award once for the film and again for each person on it (each producer of a
 * Best Picture, say). This folds them into one line per award, category and year, naming the
 * people, with a win replacing the nomination it came from.
 */
export function combineEntries(entries: Entry[]): Award[] {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = [e.award, e.base, e.year].join("|").toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const out: Award[] = [];
  const line = (e: Entry, people: string[], result: Award["result"]): Award => ({
    award: e.award, category: people.length ? (e.base ? `${e.base}: ${people.join(", ")}` : people.join(", ")) : e.base, result, year: e.year,
  });
  for (const list of groups.values()) {
    const people = (r: string) => [...new Set(list.filter((e) => e.result === r && e.person).map((e) => e.person))];
    const won = people("won"), nominated = people("nominated").filter((p) => !won.includes(p));
    if (list.some((e) => e.result === "won")) {
      out.push(line(list[0], won, "won"));
      if (nominated.length) out.push(line(list[0], nominated, "nominated"));
    } else out.push(line(list[0], nominated, "nominated"));
  }
  return mergeAwards(out);
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
export async function wikidataAwards(tmdbId: number, filmYear: number, imdbId?: string | null): Promise<Award[] | null> {
  try {
    const json = await askWikidata(query(tmdbId, imdbId));
    if (!json) return null;
    const rows = (json.results?.bindings ?? []).map((b) => ({
      kind: b.kind?.value ?? "", award: b.awardLabel?.value ?? "", by: b.byLabel?.value, person: b.personLabel?.value, time: b.time?.value, eventTime: b.eventTime?.value,
    }));
    return combineEntries(rows.flatMap((r) => toEntry(r, filmYear) ?? []));
  } catch {
    return null;
  }
}

/**
 * Asks Wikidata, waiting and trying again when it's busy: it answers 429 (too many requests) or a
 * 5xx under load, and a heavy film can take longer than a moment. Up to three tries, 30s each.
 */
async function askWikidata(sparql: string): Promise<{ results?: { bindings?: Record<string, { value: string }>[] } } | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // POST: a long query in a URL can be refused before Wikidata reads it.
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ format: "json", query: sparql }),
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) return null;
      const wait = Number(res.headers.get("retry-after")) || 2 * attempt;
      await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
    } catch {
      // A timeout or a dropped connection: try again.
    }
  }
  return null;
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

type FilmRow = { id: string; slug?: string | null; tmdb_id: number | null; year: number; awards: unknown };

/**
 * Fetches and saves one film's awards: "updated" when Wikidata had some, "none" when it has none,
 * "failed" when Wikidata couldn't be reached (so the film is worth trying again, not left as is).
 */
export async function refreshFilmAwards(db: SupabaseClient, f: FilmRow): Promise<"updated" | "none" | "failed"> {
  if (!f.tmdb_id) return "none";
  const fresh = await wikidataAwards(f.tmdb_id, f.year, await getImdbId(f.tmdb_id).catch(() => null));
  if (!fresh) return "failed";
  const awards = withWikidata((f.awards ?? []) as Award[], fresh);
  if (!awards) return "none";
  const { error } = await db.from("films").update({ awards, updated_at: new Date().toISOString() }).eq("id", f.id);
  return error ? "failed" : "updated";
}

/** Refreshes films two at a time, so Wikidata isn't sent too many requests at once. */
export async function refreshAwardsBatch(db: SupabaseClient, films: FilmRow[]): Promise<{ updated: FilmRow[]; failed: number }> {
  const updated: FilmRow[] = [];
  let failed = 0;
  for (let i = 0; i < films.length; i += 2) {
    const part = films.slice(i, i + 2);
    const done = await Promise.all(part.map((f) => refreshFilmAwards(db, f)));
    part.forEach((f, j) => {
      if (done[j] === "updated") updated.push(f);
      else if (done[j] === "failed") failed++;
    });
  }
  return { updated, failed };
}
