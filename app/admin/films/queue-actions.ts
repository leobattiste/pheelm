"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin";
import type { AddResult } from "@/lib/import";
import { processQueue, type QueueItem } from "@/lib/film-queue";
import { tmdbEnabled } from "@/lib/tmdb";
import { logAdminActivity } from "@/lib/admin-activity";
import { queueCatalogSnapshot } from "@/lib/catalog-snapshot";

export type { QueueItem } from "@/lib/film-queue";

const refresh = () => { revalidatePath("/admin/films/add"); queueCatalogSnapshot(); revalidatePath("/", "layout"); };

/** Adds queued films from TMDB, a few at a time (the page calls this in small batches). */
export async function runQueue(ids: string[], publish: boolean): Promise<(AddResult & { queueId: string })[]> {
  const db = await adminClient();
  if (!tmdbEnabled) return ids.map((queueId) => ({ queueId, status: "not-found" as const, message: "Add TMDB_API_KEY in Vercel to switch on adding films from TMDB." }));
  const { data: items } = await db.from("film_queue").select("*").in("id", ids.slice(0, 6));
  const results = await processQueue(db, (items ?? []) as QueueItem[], publish);
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
