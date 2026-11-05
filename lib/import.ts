import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { slugify } from "./format";
import { findMovie, getMovie, getPersonDetails, searchMovies } from "./tmdb";
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
  // A film added without details starts as a feature; TMDB's genres and runtime say if it's something else.
  if (film.type === "feature" && update.genres) {
    if (m.genres.includes("Animation")) update.type = "animation";
    else if (m.genres.includes("Documentary")) update.type = "documentary";
    else if (m.runtime && m.runtime <= 40) update.type = "short";
  }
  // The page tint comes from the poster, unless a colour was picked by hand.
  const poster = (update.poster_url as string | undefined) ?? film.poster_url;
  if (!film.color && poster) {
    const color = await posterColour(poster);
    if (color) update.color = color;
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

  // Everyone on the film gets their biography, dates, birthplace and links, once.
  const ids = [...new Set(m.people.map((p) => p.tmdb_id))];
  const { data: rows } = await db.from("people").select("*").in("tmdb_id", ids);
  const todo = (rows ?? []).filter((p) => !p.details_at);
  for (let i = 0; i < todo.length; i += 5) await Promise.all(todo.slice(i, i + 5).map((p) => fillPerson(db, p)));

  const filled = Object.keys(update).filter((k) => !["tmdb_id", "watch", "updated_at", "color", "type"].includes(k));
  const parts = [
    filled.length ? `filled ${filled.map((k) => k.replace("_url", "").replace("_", " ")).join(", ")}` : "nothing empty to fill",
    `${added} new credits`,
    `${m.watch.length} viewing options`,
  ];
  return `${film.title}: ${parts.join(" · ")}.`;
}

export type AddResult = { status: "added" | "exists" | "not-found"; message: string; id?: string };

/**
 * Adds a film from just its title and year: finds it on TMDB, creates it, and fills everything
 * (poster, synopsis, director, cast and crew, trailer, where to watch). Films already in the
 * directory are left alone.
 */
export async function addFilmByTitle(
  db: SupabaseClient,
  title: string,
  year: number | null,
  options: { publish: boolean; collectionId?: string | null },
): Promise<AddResult> {
  const label = year ? `${title} (${year})` : title;

  // Already here under this title and about this year?
  let q = db.from("films").select("id, title").ilike("title", title.replace(/[%_]/g, "\\$&"));
  if (year) q = q.gte("year", year - 1).lte("year", year + 1);
  const { data: same } = await q.limit(1);
  if (same?.length) {
    await addToCollection(db, same[0].id, options.collectionId);
    return { status: "exists", message: `${label}: already in the directory.`, id: same[0].id };
  }

  // Without a year, take TMDB's best match for the title.
  const tmdbId = year ? await findMovie(title, year, []) : ((await searchMovies(title))[0]?.id ?? null);
  if (!tmdbId) return { status: "not-found", message: `${label}: no confident match on TMDB. Add it by hand with its TMDB id.` };

  const { data: byTmdb } = await db.from("films").select("id, title").eq("tmdb_id", tmdbId).maybeSingle();
  if (byTmdb) {
    await addToCollection(db, byTmdb.id, options.collectionId);
    return { status: "exists", message: `${label}: already in the directory as ${byTmdb.title}.`, id: byTmdb.id };
  }

  const m = await getMovie(tmdbId);
  const filmYear = m.year ?? year ?? new Date().getFullYear();
  let slug = slugify(m.title);
  const { data: clash } = await db.from("films").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${filmYear}`;
  const { data: created, error } = await db
    .from("films")
    .insert({ title: m.title, slug, year: filmYear, tmdb_id: tmdbId, status: options.publish ? "published" : "draft" })
    .select("id")
    .single();
  if (error || !created) return { status: "not-found", message: `${label}: couldn't be added (${error?.message}).` };

  await importFilm(db, created.id);
  await addToCollection(db, created.id, options.collectionId);
  const directors = m.people.filter((p) => p.role === "director").map((p) => p.name).join(", ");
  return { status: "added", message: `${m.title} (${filmYear})${directors ? `, ${directors}` : ""}: added.`, id: created.id };
}

async function addToCollection(db: SupabaseClient, filmId: string, collectionId?: string | null) {
  if (!collectionId) return;
  const { data: film } = await db.from("films").select("year").eq("id", filmId).single();
  await db.from("collection_films").upsert({ collection_id: collectionId, film_id: filmId, sort: film?.year ?? 0 }, { onConflict: "collection_id,film_id", ignoreDuplicates: true });
}

/**
 * Fills a person's empty fields from TMDB: biography, birth and death dates, birthplace, the job
 * they're best known for, IMDb and Instagram, and a portrait. Anything already written stays.
 * Before supabase/people-details.sql has run, only the older fields (bio, birth year, portrait) fill.
 */
export async function fillPerson(db: SupabaseClient, person: Record<string, any>) {
  if (!person.tmdb_id) return false;
  const d = await getPersonDetails(person.tmdb_id);
  const patch: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => { if (!person[key] && value) patch[key] = value; };
  set("bio", d.bio?.split("\n\n").slice(0, 4).join("\n\n"));
  set("birth_year", d.birth_year);
  set("photo_url", d.photo_url);
  const migrated = "details_at" in person;
  if (migrated) {
    set("born", d.born);
    set("died", d.died);
    set("birthplace", d.birthplace);
    set("known_for", d.known_for);
    set("imdb_id", d.imdb_id);
    set("instagram", d.instagram);
    patch.details_at = new Date().toISOString();
  }
  if (Object.keys(patch).length) await db.from("people").update(patch).eq("id", person.id);
  return migrated;
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

/** The poster's dominant colour as a hex string, or null if the image can't be read. */
export async function posterColour(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const { dominant } = await sharp(Buffer.from(await res.arrayBuffer())).resize(48, 72, { fit: "cover" }).stats();
    return "#" + [dominant.r, dominant.g, dominant.b].map((n) => n.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
