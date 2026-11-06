"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/admin";
import { slugify } from "@/lib/format";
import { addFilmByTitle, fillPerson, importFilm, posterColour, type AddResult } from "@/lib/import";
import { tmdbEnabled } from "@/lib/tmdb";
import type { Award, Role, WatchOption } from "@/lib/types";

export type Result = { ok: boolean; message: string };

const str = (f: FormData, k: string, max = 5000) => String(f.get(k) ?? "").trim().slice(0, max);
const nullable = (f: FormData, k: string, max = 5000) => str(f, k, max) || null;
const int = (f: FormData, k: string) => {
  const v = str(f, k);
  return v && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null;
};
const list = (f: FormData, k: string) => str(f, k).split(",").map((s) => s.trim()).filter(Boolean);
const refresh = () => revalidatePath("/", "layout");
const fail = (e: unknown): Result => ({ ok: false, message: e instanceof Error ? e.message : "Something went wrong." });

/** Uploads an image to the public "images" bucket and returns its address. */
async function upload(db: SupabaseClient, file: FormDataEntryValue | null, folder: string): Promise<string | null> {
  if (!(file instanceof File) || !file.size) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Images must be JPEG, PNG or WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be under 10 MB.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from("images").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}. Did you run supabase/storage.sql?`);
  return db.storage.from("images").getPublicUrl(path).data.publicUrl;
}

// Films ---------------------------------------------------------------------------

const ROLE_ALIASES: Record<string, Role> = {
  director: "director", directors: "director", writer: "writer", screenplay: "writer", producer: "producer",
  cinematographer: "cinematographer", cinematography: "cinematographer", dp: "cinematographer",
  editor: "editor", editing: "editor", composer: "composer", music: "composer", cast: "cast", actor: "cast",
};

function parseCredits(text: string) {
  const out: { role: Role; name: string; character: string | null }[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([a-z ]+?)\s*:\s*(.+)$/i);
    if (!m) continue;
    const role = ROLE_ALIASES[m[1].toLowerCase().trim()];
    if (!role) throw new Error(`Unknown role "${m[1]}". Use director, writer, producer, cinematographer, editor, composer or cast.`);
    const [name, character] = m[2].split(/\s+as\s+/);
    if (name.trim()) out.push({ role, name: name.trim(), character: character?.trim() || null });
  }
  return out;
}

function parseAwards(text: string): Award[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [award, category, result, year] = line.split("|").map((s) => s.trim());
    if (!award || !category || !["won", "nominated"].includes(result) || !/^\d{4}$/.test(year)) {
      throw new Error(`Award lines look like "Cannes Film Festival | Grand Prix | won | 2019". Check: ${line}`);
    }
    return { award, category, result: result as Award["result"], year: Number(year) };
  });
}

function parseWatch(text: string): WatchOption[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [provider, url, kind = "stream", region] = line.split("|").map((s) => s.trim());
    if (!provider || !/^https?:\/\//.test(url ?? "") || !["stream", "free", "rent", "buy"].includes(kind)) {
      throw new Error(`Viewing lines look like "Criterion Channel | https://… | stream | US". Check: ${line}`);
    }
    return { provider, url, kind: kind as WatchOption["kind"], ...(region ? { region: region.toUpperCase() } : {}) };
  });
}

async function personId(db: SupabaseClient, name: string) {
  const slug = slugify(name);
  const { data } = await db.from("people").select("id").eq("slug", slug).maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await db.from("people").insert({ slug, name }).select("id").single();
  if (error || !created) throw new Error(`Couldn't add ${name}: ${error?.message}`);
  return created.id as string;
}

export async function saveFilm(_prev: Result, f: FormData): Promise<Result> {
  try {
    const db = await adminClient();
    const id = str(f, "id");
    const title = str(f, "title", 300);
    const year = int(f, "year");
    if (!title || !year) return { ok: false, message: "Every film needs a title and a year." };
    const credits = parseCredits(str(f, "credits", 20000));
    if (!credits.some((c) => c.role === "director")) return { ok: false, message: "Add at least one line like  director: Name" };

    const poster = (await upload(db, f.get("poster_file"), "posters")) ?? nullable(f, "poster_url", 1000);
    // A new poster brings its own colour, unless one was typed in.
    const typed = str(f, "color").toLowerCase();
    let color: string | null = /^#[0-9a-f]{6}$/.test(typed) ? typed : null;
    if (poster && poster !== str(f, "previous_poster") && typed === str(f, "previous_color").toLowerCase()) {
      color = (await posterColour(poster)) ?? color;
    }
    const row = {
      title,
      slug: slugify(str(f, "slug") || title),
      original_title: nullable(f, "original_title", 300),
      year,
      type: str(f, "type") || "feature",
      status: str(f, "status") === "draft" ? "draft" : "published",
      featured: f.get("featured") === "on",
      countries: list(f, "countries").map((c) => c.toUpperCase()),
      languages: list(f, "languages"),
      genres: list(f, "genres"),
      runtime: int(f, "runtime"),
      synopsis: nullable(f, "synopsis"),
      poster_url: poster,
      color,
      backdrop_url: nullable(f, "backdrop_url", 1000),
      trailer_url: nullable(f, "trailer_url", 1000),
      tmdb_id: int(f, "tmdb_id"),
      awards: parseAwards(str(f, "awards", 20000)),
      watch: parseWatch(str(f, "watch", 20000)),
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("films").update(row).eq("id", id);
    if (error) return { ok: false, message: error.code === "23505" ? "Another film already uses that address or TMDB id." : error.message };

    // Credits are replaced with what's in the box, in that order.
    const ids = await Promise.all(credits.map((c) => personId(db, c.name)));
    const rows = credits.map((c, i) => ({ film_id: id, person_id: ids[i], role: c.role, character: c.character, sort: i }));
    const unique = rows.filter((r, i) => rows.findIndex((x) => x.person_id === r.person_id && x.role === r.role) === i);
    await db.from("credits").delete().eq("film_id", id);
    const { error: cErr } = await db.from("credits").insert(unique);
    if (cErr) return { ok: false, message: cErr.message };

    const chosen = f.getAll("collections").map(String);
    await db.from("collection_films").delete().eq("film_id", id);
    if (chosen.length) await db.from("collection_films").insert(chosen.map((c) => ({ collection_id: c, film_id: id, sort: year })));

    refresh();
    return { ok: true, message: row.status === "draft" ? "Saved as a draft." : "Saved and live." };
  } catch (e) {
    return fail(e);
  }
}

export async function createFilm(f: FormData) {
  const db = await adminClient();
  const title = str(f, "title", 300);
  const year = int(f, "year") ?? new Date().getFullYear();
  const director = str(f, "director", 200);
  const tmdb = int(f, "tmdb_id");
  if (!title) throw new Error("Add a title.");
  let slug = slugify(title);
  const { data: clash } = await db.from("films").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${year}`;
  const { data, error } = await db.from("films").insert({ title, slug, year, status: "draft", tmdb_id: tmdb }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't create the film.");
  if (director) await db.from("credits").insert({ film_id: data.id, person_id: await personId(db, director), role: "director", sort: 0 });
  if (tmdbEnabled && (director || tmdb)) {
    try {
      await importFilm(db, data.id);
    } catch {}
  }
  redirect(`/admin/films/${data.id}`);
}

export async function deleteFilm(f: FormData) {
  const db = await adminClient();
  await db.from("films").delete().eq("id", str(f, "id"));
  refresh();
  redirect("/admin/films");
}

export async function importOne(id: string): Promise<Result> {
  try {
    if (!tmdbEnabled) return { ok: false, message: "Add TMDB_API_KEY in Vercel to switch on the import." };
    const db = await adminClient();
    const message = await importFilm(db, id);
    refresh();
    return { ok: true, message };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Fills in up to twenty people from TMDB (biography, dates, birthplace, links). The admin page calls
 * it repeatedly until none are left, so it never hits a server time limit.
 */
export async function fillPeople(): Promise<Result & { remaining: number }> {
  try {
    if (!tmdbEnabled) return { ok: false, message: "Add TMDB_API_KEY in Vercel to switch on the import.", remaining: 0 };
    const db = await adminClient();
    const { data, error } = await db.from("people").select("*").not("tmdb_id", "is", null).is("details_at", null).limit(20);
    if (error) return { ok: false, message: "Run supabase/people-details.sql in Supabase first, then try again.", remaining: 0 };
    await Promise.all((data ?? []).map((p) => fillPerson(db, p)));
    const { count } = await db.from("people").select("*", { count: "exact", head: true }).not("tmdb_id", "is", null).is("details_at", null);
    refresh();
    return { ok: true, message: `Filled ${data?.length ?? 0} people.`, remaining: count ?? 0 };
  } catch (e) {
    return { ...fail(e), remaining: 0 };
  }
}

/**
 * A few lines of the bulk add tool at once. Next runs one server action at a time per visitor,
 * so the batch is done here, in parallel, rather than as separate calls from the browser.
 */
export async function addMany(lines: { title: string; year: number | null }[], publish: boolean, collectionId: string | null): Promise<AddResult[]> {
  return Promise.all(lines.map((l) => addOne(l.title, l.year, publish, collectionId)));
}

/** A few films' TMDB imports at once, for the same reason. */
export async function importMany(ids: string[]): Promise<Result[]> {
  return Promise.all(ids.map((id) => importOne(id)));
}

/** One line of the bulk add tool: a title and an optional year. */
export async function addOne(title: string, year: number | null, publish: boolean, collectionId: string | null): Promise<AddResult> {
  try {
    if (!tmdbEnabled) return { status: "not-found", message: "Add TMDB_API_KEY in Vercel to switch on adding films from TMDB." };
    const db = await adminClient();
    const r = await addFilmByTitle(db, title.slice(0, 300), year, { publish, collectionId });
    if (r.status === "added") refresh();
    return r;
  } catch (e) {
    return { status: "not-found", message: `${title}: ${e instanceof Error ? e.message : "something went wrong."}` };
  }
}

// People ----------------------------------------------------------------------------

export async function savePerson(_prev: Result, f: FormData): Promise<Result> {
  try {
    const db = await adminClient();
    const name = str(f, "name", 200);
    if (!name) return { ok: false, message: "Add a name." };
    const photo = (await upload(db, f.get("photo_file"), "people")) ?? nullable(f, "photo_url", 1000);
    const { error } = await db.from("people").update({
      name,
      slug: slugify(str(f, "slug") || name),
      country: nullable(f, "country", 2)?.toUpperCase() ?? null,
      birth_year: int(f, "birth_year"),
      bio: nullable(f, "bio", 5000),
      photo_url: photo,
      tmdb_id: int(f, "tmdb_id"),
    }).eq("id", str(f, "id"));
    if (error) return { ok: false, message: error.code === "23505" ? "Someone else already uses that address or TMDB id." : error.message };
    refresh();
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

// Collections --------------------------------------------------------------------------

export async function createCollection(f: FormData) {
  const db = await adminClient();
  const title = str(f, "title", 200);
  if (!title) throw new Error("Add a title.");
  const { data, error } = await db.from("collections").insert({ title, slug: slugify(title) }).select("id").single();
  if (error || !data) throw new Error(error?.code === "23505" ? "A collection with that name exists." : error?.message);
  redirect(`/admin/collections/${data.id}`);
}

export async function saveCollection(_prev: Result, f: FormData): Promise<Result> {
  try {
    const db = await adminClient();
    const id = str(f, "id");
    const title = str(f, "title", 200);
    if (!title) return { ok: false, message: "Add a title." };
    const { error } = await db.from("collections").update({
      title,
      slug: slugify(str(f, "slug") || title),
      description: nullable(f, "description", 3000),
      kind: str(f, "kind") || "theme",
      featured: f.get("featured") === "on",
      sort_order: int(f, "sort_order") ?? 99,
    }).eq("id", id);
    if (error) return { ok: false, message: error.message };
    const films = f.getAll("films").map(String);
    await db.from("collection_films").delete().eq("collection_id", id);
    if (films.length) {
      const { data: years } = await db.from("films").select("id, year").in("id", films);
      const yearOf = new Map((years ?? []).map((y) => [y.id, y.year]));
      await db.from("collection_films").insert(films.map((film_id) => ({ collection_id: id, film_id, sort: yearOf.get(film_id) ?? 0 })));
    }
    refresh();
    return { ok: true, message: `Saved with ${films.length} films.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCollection(f: FormData) {
  const db = await adminClient();
  await db.from("collections").delete().eq("id", str(f, "id"));
  refresh();
  redirect("/admin/collections");
}

// Journal ----------------------------------------------------------------------------------

export async function createArticle(f: FormData) {
  const db = await adminClient();
  const title = str(f, "title", 300);
  if (!title) throw new Error("Add a title.");
  let slug = slugify(title);
  const { data: clash } = await db.from("articles").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;
  const { data, error } = await db.from("articles").insert({ title, slug }).select("id").single();
  if (error || !data) throw new Error(error?.message);
  redirect(`/admin/journal/${data.id}`);
}

export async function saveArticle(_prev: Result, f: FormData): Promise<Result> {
  try {
    const db = await adminClient();
    const title = str(f, "title", 300);
    if (!title) return { ok: false, message: "Add a title." };
    const status = str(f, "status") === "published" ? "published" : "draft";
    const cover = (await upload(db, f.get("cover_file"), "journal")) ?? nullable(f, "cover_url", 1000);
    const date = str(f, "published_at");
    const { error } = await db.from("articles").update({
      title,
      slug: slugify(str(f, "slug") || title),
      dek: nullable(f, "dek", 500),
      kind: str(f, "kind") || "essay",
      author: nullable(f, "author", 200),
      cover_url: cover,
      body: str(f, "body", 100000),
      film_ids: f.getAll("films").map(String),
      status,
      published_at: date ? new Date(date).toISOString() : status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", str(f, "id"));
    if (error) return { ok: false, message: error.code === "23505" ? "Another story already uses that address." : error.message };
    refresh();
    return { ok: true, message: status === "published" ? "Published." : "Saved as a draft." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteArticle(f: FormData) {
  const db = await adminClient();
  await db.from("articles").delete().eq("id", str(f, "id"));
  refresh();
  redirect("/admin/journal");
}

// Submissions ---------------------------------------------------------------------------------

export async function reviewSubmission(f: FormData) {
  const db = await adminClient();
  const id = str(f, "id");
  const decision = str(f, "decision");
  const { data: s } = await db.from("submissions").select("*").eq("id", id).single();
  if (!s) throw new Error("Submission not found.");

  if (decision === "approve") {
    const form = new FormData();
    form.set("title", s.title);
    form.set("year", String(s.year ?? new Date().getFullYear()));
    form.set("director", s.director);
    // Creates a draft (and imports it from TMDB when switched on), then opens it in the editor.
    await db.from("submissions").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", id);
    await createFilm(form);
  } else {
    await db.from("submissions").update({ status: decision === "reject" ? "rejected" : "pending", reviewed_at: new Date().toISOString() }).eq("id", id);
    revalidatePath("/admin/submissions");
  }
}

/** Marks a contact message as answered, or moves it back. */
export async function setMessageHandled(f: FormData) {
  const db = await adminClient();
  await db.from("messages").update({ handled: f.get("handled") === "true" }).eq("id", String(f.get("id")));
  revalidatePath("/admin/inbox");
}

/** Staff-picks or hides a member's collection (or undoes it). */
export async function setListFlag(f: FormData) {
  const db = await adminClient();
  const field = f.get("field") === "staff_pick" ? "staff_pick" : "hidden";
  await db.from("lists").update({ [field]: f.get("value") === "true" }).eq("id", String(f.get("id")));
  revalidatePath("/admin/community");
  revalidatePath("/collections");
  revalidatePath("/collections/community");
}

/** Dismisses a report once it's been dealt with. */
export async function resolveReport(f: FormData) {
  const db = await adminClient();
  await db.from("list_reports").update({ resolved: true }).eq("id", String(f.get("id")));
  revalidatePath("/admin/community");
}
