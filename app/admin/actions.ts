"use server";

import { safeInternalPath } from "@/lib/safe-navigation";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient, ownerClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { slugify } from "@/lib/format";
import { addFilmByTitle, fillPerson, importFilm, posterColour, type AddResult } from "@/lib/import";
import { getWatch, tmdbEnabled } from "@/lib/tmdb";
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
      // Only sent when the editor showed these fields (they need the aka and note columns).
      ...(f.has("aka") ? { aka: str(f, "aka", 2000).split(";").map((s) => s.trim()).filter(Boolean) } : {}),
      ...(f.has("note") ? { note: nullable(f, "note", 600) } : {}),
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

    await logAdminActivity(db, "Saved film", "film", id, `${title} (${year}) · ${row.status}`);
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
  await logAdminActivity(db, "Created film draft", "film", data.id, `${title} (${year})`);
  redirect(`/admin/films/${data.id}`);
}

export async function deleteFilm(f: FormData) {
  const db = await ownerClient();
  const id = str(f, "id");
  const { error } = await db.from("films").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity(db, "Deleted film", "film", id);
  refresh();
  redirect("/admin/films");
}

export async function importOne(id: string): Promise<Result> {
  try {
    if (!tmdbEnabled) return { ok: false, message: "Add TMDB_API_KEY in Vercel to switch on the import." };
    const db = await adminClient();
    const message = await importFilm(db, id);
    await logAdminActivity(db, "Imported TMDB metadata", "film", id);
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
 * Refreshes where to watch (and the services' logos) for fifteen films at a time, starting after
 * `offset`, so it never hits a server time limit. Links added by hand are kept.
 */
export async function refreshWatch(offset: number): Promise<Result & { next: number; total: number }> {
  try {
    if (!tmdbEnabled) return { ok: false, message: "Add TMDB_API_KEY in Vercel to switch on the import.", next: 0, total: 0 };
    const db = await adminClient();
    const { count } = await db.from("films").select("*", { count: "exact", head: true }).not("tmdb_id", "is", null);
    const { data } = await db.from("films").select("id, tmdb_id, watch").not("tmdb_id", "is", null).order("id").range(offset, offset + 14);
    await Promise.all((data ?? []).map(async (f) => {
      const fresh = await getWatch(f.tmdb_id as number);
      const manual = ((f.watch ?? []) as WatchOption[]).filter((w) => !w.url.includes("themoviedb.org") && !w.url.includes("justwatch.com"));
      await db.from("films").update({ watch: [...manual, ...fresh], updated_at: new Date().toISOString() }).eq("id", f.id);
    }));
    const next = offset + (data?.length ?? 0);
    if (next >= (count ?? 0)) refresh();
    return { ok: true, message: `Refreshed ${next} of ${count ?? 0}.`, next, total: count ?? 0 };
  } catch (e) {
    return { ...fail(e), next: offset, total: 0 };
  }
}

/**
 * A few lines of the bulk add tool at once. Next runs one server action at a time per visitor,
 * so the batch is done here, in parallel, rather than as separate calls from the browser.
 */
export async function addMany(lines: { title: string; year: number | null }[], publish: boolean, collectionId: string | null): Promise<AddResult[]> {
  return Promise.all(lines.map((l) => addOne(l.title, l.year, publish, collectionId)));
}

/**
 * A few films from the queue (data/film-queue.json) at once. Each is added and published only when
 * TMDB credits one of its expected directors, so a namesake or remake never gets in.
 */
export async function addQueued(items: { t: string; y: number; d: string[]; n?: string }[]): Promise<AddResult[]> {
  return Promise.all(items.map(async (i) => {
    try {
      if (!tmdbEnabled) return { status: "not-found" as const, message: "Add TMDB_API_KEY in Vercel to switch on adding films from TMDB." };
      const db = await adminClient();
      const r = await addFilmByTitle(db, i.t, i.y, { publish: true, directors: i.d, directorName: i.n });
      if (r.status === "added") refresh();
      return r;
    } catch (e) {
      return { status: "not-found" as const, message: `${i.t}: ${e instanceof Error ? e.message : "something went wrong."}` };
    }
  }));
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
      ...(f.has("has_in_directory") ? { in_directory: f.get("in_directory") === "on" } : {}),
    }).eq("id", str(f, "id"));
    if (error) return { ok: false, message: error.code === "23505" ? "Someone else already uses that address or TMDB id." : error.message };
    await logAdminActivity(db, "Saved person", "person", str(f, "id"), name);
    refresh();
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

// Submissions ---------------------------------------------------------------------------------

export async function reviewSubmission(f: FormData) {
  const db = await adminClient();
  const id = str(f, "id");
  const decision = str(f, "decision");
  if (decision !== "approve" && decision !== "reject") throw new Error("Choose approve or reject.");
  const reviewNote = nullable(f, "review_note", 1500);
  const { data: { user: reviewer } } = await db.auth.getUser();
  const { data: s, error: loadError } = await db.from("submissions").select("*").eq("id", id).single();
  if (loadError || !s || s.status !== "pending") throw new Error("This submission is no longer pending.");

  if (decision === "approve") {
    // Create the draft first: a failed film creation must not silently approve a submission.
    const year = s.year ?? new Date().getFullYear();
    let slug = slugify(s.title);
    if ((await db.from("films").select("id").eq("slug", slug).maybeSingle()).data) slug = `${slug}-${year}`;
    if ((await db.from("films").select("id").eq("slug", slug).maybeSingle()).data) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;
    const { data: film, error: filmError } = await db.from("films").insert({
      title: s.title, slug, year, status: "draft",
    }).select("id").single();
    if (filmError || !film) throw new Error(filmError?.message ?? "Could not create draft.");
    if (s.director?.trim()) {
      const person = await personId(db, s.director.trim());
      const { error: creditError } = await db.from("credits").insert({ film_id: film.id, person_id: person, role: "director", sort: 0 });
      if (creditError) throw new Error(creditError.message);
    }
    if (tmdbEnabled && s.director?.trim()) {
      try { await importFilm(db, film.id); } catch (error) { console.error("Submitted film metadata import:", error); }
    }
    const { error: updateError } = await db.from("submissions").update({
      status: "approved", reviewed_at: new Date().toISOString(),
      review_note: reviewNote, reviewed_by: reviewer?.id ?? null,
    }).eq("id", id);
    if (updateError) throw new Error(updateError.message);
    await logAdminActivity(db, "Approved submission", "submission", id, s.title);
    refresh();
    redirect(`/admin/films/${film.id}`);
  }

  const { error: updateError } = await db.from("submissions").update({
    status: "rejected", reviewed_at: new Date().toISOString(),
    review_note: reviewNote, reviewed_by: reviewer?.id ?? null,
  }).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  await logAdminActivity(db, "Rejected submission", "submission", id, s.title);
  revalidatePath("/admin/submissions");
}

/** Marks a contact message as answered, or moves it back. */
export async function setMessageHandled(f: FormData) {
  const db = await adminClient();
  const id = String(f.get("id"));
  const { error } = await db.from("messages").update({ handled: f.get("handled") === "true" }).eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity(db, f.get("handled") === "true" ? "Closed message" : "Reopened message", "message", id);
  revalidatePath("/admin/inbox");
}

/** Staff-picks, features or hides a member's collection (or undoes it). */
export async function setListFlag(f: FormData) {
  const db = await adminClient();
  const raw = String(f.get("field"));
  const field = raw === "staff_pick" || raw === "featured" ? raw : "hidden";
  const id = String(f.get("id"));
  const { error } = await db.from("lists").update({ [field]: f.get("value") === "true" }).eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity(db, "Updated collection", "collection", id, `${field}: ${f.get("value")}`);
  revalidatePath("/admin/community");
  revalidatePath("/watchlists");
  revalidatePath(`/c/${id}`);
  revalidatePath("/");
  const back = String(f.get("back") ?? "");
  const destination = safeInternalPath(back);
  if (destination) redirect(destination);
}

/** Makes a member an admin, or takes it away. Only the owner can. */
export async function setAdmin(f: FormData) {
  const db = await ownerClient();
  const id = String(f.get("id"));
  const { error } = await db.rpc("set_admin", { who: id, make: f.get("make") === "true" });
  if (error) throw new Error(error.message);
  await logAdminActivity(db, f.get("make") === "true" ? "Granted admin role" : "Revoked admin role", "member", id);
  revalidatePath("/admin/members");
}

/** Dismisses a report once it's been dealt with. */
export async function resolveCommentReport(f: FormData) {
  const db = await adminClient();
  const id = String(f.get("id"));
  const { error } = await db.from("comment_reports").update({ resolved: true }).eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity(db, "Dismissed comment report", "comment", id);
  revalidatePath("/admin/community");
}

/** Removes a reported comment (it stays as "Comment removed" if it has replies) and closes its reports. */
export async function removeReportedComment(f: FormData) {
  const db = await adminClient();
  const commentId = String(f.get("comment_id"));
  const { error: removalError } = await db.rpc("remove_comment", { cid: commentId });
  if (removalError) throw new Error(removalError.message);
  const { error: reportError } = await db.from("comment_reports").update({ resolved: true }).eq("comment_id", commentId);
  if (reportError) throw new Error(reportError.message);
  await logAdminActivity(db, "Removed reported comment", "comment", commentId);
  revalidatePath("/admin/community");
}

export async function resolveReport(f: FormData) {
  const db = await adminClient();
  const id = String(f.get("id"));
  const { error } = await db.from("list_reports").update({ resolved: true }).eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity(db, "Dismissed collection report", "collection", id);
  revalidatePath("/admin/community");
}
