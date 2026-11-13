"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin";
import { addFilmByTitle, type AddResult } from "@/lib/import";
import { tmdbEnabled } from "@/lib/tmdb";
import { logAdminActivity } from "@/lib/admin-activity";

export type QueueItem = { id: string; title: string; year: number | null; director_name: string | null; director_keys: string[]; synopsis: string | null; last_error: string | null };



const refresh = () => { revalidatePath("/admin/films/add"); revalidatePath("/", "layout"); };

/**
 * Adds queued films from TMDB, a few at a time (the page calls this in small batches). A film is
 * matched on title and year, checked against its director when the queue knows one, and published
 * straight away unless `publish` is off. An item's essay becomes the film's synopsis. Added films,
 * and films already in the catalog, leave the queue; ones TMDB can't match stay with the reason.
 */
export async function runQueue(ids: string[], publish: boolean): Promise<(AddResult & { queueId: string })[]> {
  const db = await adminClient();
  if (!tmdbEnabled) return ids.map((queueId) => ({ queueId, status: "not-found" as const, message: "Add TMDB_API_KEY in Vercel to switch on adding films from TMDB." }));
  const { data: items } = await db.from("film_queue").select("*").in("id", ids.slice(0, 6));
  const results = await Promise.all((items ?? []).map(async (item: QueueItem) => {
    try {
      const r = await addFilmByTitle(db, item.title, item.year, {
        publish, directors: item.director_keys.length ? item.director_keys : undefined, directorName: item.director_name ?? undefined,
      });
      if (r.status !== "not-found" && r.id) {
        if (item.synopsis) await db.from("films").update({ synopsis: item.synopsis, updated_at: new Date().toISOString() }).eq("id", r.id);
        await db.from("film_queue").delete().eq("id", item.id);
        if (r.status === "added") await logAdminActivity(db, "Added film from the queue", "film", r.id, `${item.title}${item.year ? ` (${item.year})` : ""}`);
      } else {
        await db.from("film_queue").update({ last_error: r.message.slice(0, 500) }).eq("id", item.id);
      }
      return { ...r, queueId: item.id };
    } catch (e) {
      const message = `${item.title}: ${e instanceof Error ? e.message : "something went wrong."}`;
      await db.from("film_queue").update({ last_error: message.slice(0, 500) }).eq("id", item.id);
      return { status: "not-found" as const, message, queueId: item.id };
    }
  }));
  const added = results.filter((r) => r.status === "added").length;
  if (!added) await logAdminActivity(db, "Ran the film queue", "film", null, `${results.length} tried, none added`);
  refresh();
  return results;
}

/** Saves a pasted list to the queue to add later. Films already queued are skipped. */
export async function saveToQueue(lines: { title: string; year: number | null }[]): Promise<{ ok: boolean; message: string }> {
  try {
    const db = await adminClient();
    const rows = lines.slice(0, 500).map((l) => ({ title: l.title.slice(0, 300), year: l.year }));
    if (!rows.length) return { ok: false, message: "Paste at least one film." };
    // One at a time: a film already in the queue is skipped by the unique title-and-year rule.
    let saved = 0;
    for (const row of rows) { const { error } = await db.from("film_queue").insert(row); if (!error) saved++; }
    if (saved) await logAdminActivity(db, "Saved films to the queue", "film", null, `${saved} ${saved === 1 ? "film" : "films"}`);
    refresh();
    const skipped = rows.length - saved;
    return { ok: true, message: `${saved} ${saved === 1 ? "film" : "films"} added to the queue${skipped ? `, ${skipped} already there` : ""}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "That didn't save. Try again." };
  }
}

export async function removeFromQueue(id: string) {
  const db = await adminClient();
  const { data } = await db.from("film_queue").delete().eq("id", id).select("title, year").maybeSingle();
  if (data) await logAdminActivity(db, "Removed film from the queue", "film", null, `${data.title}${data.year ? ` (${data.year})` : ""}`);
  refresh();
}

/** Empties the queue. Films already added aren't touched. */
export async function clearQueue() {
  const db = await adminClient();
  await db.from("film_queue").delete().not("id", "is", null);
  await logAdminActivity(db, "Cleared the film queue", "film", null, "");
  refresh();
}
