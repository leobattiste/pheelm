import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAdminActivity } from "./admin-activity";
import { addFilmByTitle, type AddResult } from "./import";
import { TmdbTransientError } from "./tmdb";

/** A film TMDB keeps failing on for this long (busy, down) stops being retried and keeps its reason. */
const RETRY_FOR_MS = 3 * 24 * 60 * 60_000;

export type QueueItem = { id: string; title: string; year: number | null; director_name: string | null; director_keys: string[]; synopsis: string | null; last_error: string | null; created_at?: string };

/**
 * Adds queued films from TMDB. A film is matched on title and year, checked against its director
 * when the queue knows one, and published unless `publish` is off. An item's essay becomes the
 * film's synopsis. Added films, and films already in the catalog, leave the queue; ones TMDB
 * can't match stay with the reason. When TMDB is busy or down, the film goes back in the queue for the
 * next run instead. Used by the admin page and by /api/internal/queue.
 */
export async function processQueue(db: SupabaseClient, items: QueueItem[], publish: boolean, worker = false): Promise<(AddResult & { queueId: string })[]> {
  return Promise.all(items.map(async (item) => {
    try {
      const r = await addFilmByTitle(db, item.title, item.year, {
        publish, directors: item.director_keys.length ? item.director_keys : undefined, directorName: item.director_name ?? undefined,
      });
      if (r.status !== "not-found" && r.id) {
        if (item.synopsis) await db.from("films").update({ synopsis: item.synopsis, updated_at: new Date().toISOString() }).eq("id", r.id);
        await db.from("film_queue").delete().eq("id", item.id);
        if (r.status === "added") await logAdminActivity(db, "Added film from the queue", "film", r.id, `${item.title}${item.year ? ` (${item.year})` : ""}`, worker);
      } else {
        await db.from("film_queue").update({ last_error: r.message.slice(0, 500) }).eq("id", item.id);
      }
      return { ...r, queueId: item.id };
    } catch (e) {
      const message = `${item.title}: ${e instanceof Error ? e.message : "something went wrong."}`;
      const fresh = !item.created_at || Date.now() - Date.parse(item.created_at) < RETRY_FOR_MS;
      if (e instanceof TmdbTransientError && fresh) {
        await db.from("film_queue").update({ last_error: null, claimed_at: null }).eq("id", item.id);
      } else {
        await db.from("film_queue").update({ last_error: message.slice(0, 500) }).eq("id", item.id);
      }
      return { status: "not-found" as const, message, queueId: item.id };
    }
  }));
}
