import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "./format";
import { findMovie, getMovie, getPersonDetails } from "./tmdb";
import type { WatchOption } from "./types";

const isTmdbLink = (url: string) => url.includes("themoviedb.org") || url.includes("justwatch.com");

/**
 * Fills a film from TMDB. Anything you've typed in the admin wins: TMDB only fills empty fields,
 * adds missing cast and crew, and refreshes its own where-to-watch links.
 */
export async function importFilm(db: SupabaseClient, filmId: string): Promise<string> {
  const { data: film, error } = await db.from("films").select("*").eq("id", filmId).single();
  if (error || !film) throw new Error("Film not found.");

  let tmdbId: number | null = film.tmdb_id;
  if (!tmdbId) {
    const { data: dirs } = await db.from("credits").select("people(name)").eq("film_id", filmId).eq("role", "director");
    const names = (dirs ?? []).map((d: any) => d.people?.name).filter(Boolean);
    tmdbId = await findMovie(film.original_title || film.title, film.year, names);
    if (!tmdbId && film.original_title) tmdbId = await findMovie(film.title, film.year, names);
    if (!tmdbId) throw new Error(`Couldn't find a confident match for ${film.title} on TMDB. Paste its TMDB id in the editor.`);
  }

  const m = await getMovie(tmdbId);
  const empty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  const manualWatch = ((film.watch ?? []) as WatchOption[]).filter((w) => !isTmdbLink(w.url));

  const update: Record<string, unknown> = { tmdb_id: tmdbId, watch: [...manualWatch, ...m.watch], updated_at: new Date().toISOString() };
  for (const key of ["original_title", "runtime", "synopsis", "poster_url", "backdrop_url", "trailer_url", "genres", "countries", "languages"] as const) {
    if (empty(film[key]) && !empty(m[key])) update[key] = m[key];
  }
  const { error: upErr } = await db.from("films").update(update).eq("id", filmId);
  if (upErr) {
    if (upErr.code === "23505") throw new Error(`Another film already uses TMDB id ${tmdbId}.`);
    throw new Error(upErr.message);
  }

  // People: match by TMDB id, then by name, so the starter catalog's people get linked, not duplicated.
  const { data: existingCredits } = await db.from("credits").select("person_id, role").eq("film_id", filmId);
  const have = new Set((existingCredits ?? []).map((c) => `${c.person_id}:${c.role}`));
  let added = 0;
  let sort = existingCredits?.length ?? 0;
  for (const p of m.people) {
    const personId = await ensurePerson(db, p.tmdb_id, p.name, p.photo);
    if (have.has(`${personId}:${p.role}`)) continue;
    have.add(`${personId}:${p.role}`);
    const { error: cErr } = await db.from("credits").insert({ film_id: filmId, person_id: personId, role: p.role, character: p.character, sort: sort++ });
    if (!cErr) added++;
  }

  // Directors also get a portrait, birth year and biography if they don't have one.
  for (const d of m.people.filter((p) => p.role === "director")) {
    const { data: person } = await db.from("people").select("id, bio, birth_year, photo_url").eq("tmdb_id", d.tmdb_id).maybeSingle();
    if (!person || (person.bio && person.birth_year && person.photo_url)) continue;
    const details = await getPersonDetails(d.tmdb_id);
    const patch: Record<string, unknown> = {};
    if (!person.bio && details.bio) patch.bio = details.bio.split("\n\n").slice(0, 2).join("\n\n");
    if (!person.birth_year && details.birth_year) patch.birth_year = details.birth_year;
    if (!person.photo_url && details.photo_url) patch.photo_url = details.photo_url;
    if (Object.keys(patch).length) await db.from("people").update(patch).eq("id", person.id);
  }

  const filled = Object.keys(update).filter((k) => !["tmdb_id", "watch", "updated_at"].includes(k));
  const parts = [
    filled.length ? `filled ${filled.map((k) => k.replace("_url", "").replace("_", " ")).join(", ")}` : "nothing empty to fill",
    `${added} new credits`,
    `${m.watch.length} viewing options`,
  ];
  return `${film.title}: ${parts.join(" · ")}.`;
}

async function ensurePerson(db: SupabaseClient, tmdbId: number, name: string, photo: string | null): Promise<string> {
  const { data: byTmdb } = await db.from("people").select("id").eq("tmdb_id", tmdbId).maybeSingle();
  if (byTmdb) return byTmdb.id;

  const base = slugify(name);
  const { data: byName } = await db.from("people").select("id, tmdb_id, photo_url").eq("slug", base).maybeSingle();
  if (byName && !byName.tmdb_id) {
    await db.from("people").update({ tmdb_id: tmdbId, ...(byName.photo_url ? {} : { photo_url: photo }) }).eq("id", byName.id);
    return byName.id;
  }
  // Someone else already has this name: give the newcomer their own page.
  const slug = byName ? `${base}-${tmdbId}` : base;
  const { data: created, error } = await db.from("people").insert({ slug, name, tmdb_id: tmdbId, photo_url: photo }).select("id").single();
  if (error || !created) throw new Error(`Couldn't add ${name}: ${error?.message}`);
  return created.id;
}
