import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAwardsBatch } from "@/lib/awards";
import { fillPerson, importFilm, refreshCredits } from "@/lib/import";
import { getChanges, getWatch } from "@/lib/tmdb";
import { fillExtras } from "@/lib/extras";
import type { WatchOption } from "@/lib/types";

/**
 * Admin automation as background jobs. Each kind works through its records in id order, one batch
 * at a time; `cursor` is the last id handled, so a job picks up where it stopped. The worker
 * (/api/internal/jobs, every minute while something runs) and the Start button both call runJobs.
 */
export type JobKind = "posters" | "synopses" | "credits" | "people" | "awards" | "watch" | "extras" | "changes";
export type Job = {
  id: string; kind: JobKind; status: "running" | "done" | "stopped" | "failed"; cursor: string | null;
  total: number; processed: number; changed: number; failed: number; last_error: string | null;
  started_by: string | null; started_at: string; updated_at: string; finished_at: string | null; locked_until: string | null;
};
type Batch = { cursor: string | null; processed: number; changed: number; failed: number; done: boolean; error?: string };
type Kind = {
  label: string;
  /** What it does, in a line. */
  summary: string;
  /** What "changed" counts, for "312 posters added". */
  unit: string;
  tmdb: boolean;
  /** How many records it still has to go through (the job's total when it starts). */
  remaining: (db: SupabaseClient) => Promise<number>;
  batch: (db: SupabaseClient, cursor: string | null) => Promise<Batch>;
};

const BLANK = (column: string) => `${column}.is.null,${column}.eq.`;
// The next slice after the cursor, in id order.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const after = (q: any, cursor: string | null) => (cursor ? q.gt("id", cursor) : q) as Promise<{ data: any[] | null; error: Error | null }>;

/** Runs work on a slice, a few at a time, and counts what changed and what failed. */
async function inGroups<T>(rows: T[], size: number, work: (row: T) => Promise<boolean | number>) {
  let changed = 0, failed = 0;
  for (let i = 0; i < rows.length; i += size) {
    const results = await Promise.allSettled(rows.slice(i, i + size).map(work));
    for (const r of results) {
      if (r.status === "rejected") failed++;
      else changed += typeof r.value === "number" ? (r.value > 0 ? 1 : 0) : r.value ? 1 : 0;
    }
  }
  return { changed, failed };
}

/**
 * The dates "Refresh changed films" covers: from the last time it finished (or a week ago the first
 * time) to today, never more than the 14 days TMDB allows.
 */
async function changesWindow(db: SupabaseClient) {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const { data } = await db.from("admin_jobs").select("finished_at").eq("kind", "changes").eq("status", "done").order("finished_at", { ascending: false }).limit(1).maybeSingle();
  const earliest = Date.now() - 13 * 86_400_000;
  const from = data?.finished_at ? Math.max(earliest, Date.parse(data.finished_at) - 86_400_000) : Date.now() - 7 * 86_400_000;
  return { start: day(new Date(from)), end: day(new Date()) };
}

const done = (rows: { id: string }[], limit: number, cursor: string | null, counts: { changed: number; failed: number }): Batch => ({
  cursor: rows.length ? rows[rows.length - 1].id : cursor, processed: rows.length, ...counts, done: rows.length < limit,
});

export const JOBS: Record<JobKind, Kind> = {
  posters: {
    label: "Fill missing posters", summary: "Finds each film on TMDB and fills its empty fields, poster first.", unit: "filled", tmdb: true,
    remaining: async (db) => (await db.from("films").select("id", { count: "exact", head: true }).or(BLANK("poster_url"))).count ?? 0,
    batch: async (db, cursor) => {
      const { data, error } = await after(db.from("films").select("id").or(BLANK("poster_url")).order("id").limit(10), cursor);
      if (error) throw error;
      const rows = data ?? [];
      return done(rows, 10, cursor, await inGroups(rows, 5, async (f) => {
        await importFilm(db, f.id);
        return !!(await db.from("films").select("poster_url").eq("id", f.id).single()).data?.poster_url;
      }));
    },
  },
  synopses: {
    label: "Fill missing synopses", summary: "Takes the synopsis from TMDB for linked films that have none. Your own text is kept.", unit: "filled", tmdb: true,
    remaining: async (db) => (await db.from("films").select("id", { count: "exact", head: true }).or(BLANK("synopsis")).not("tmdb_id", "is", null)).count ?? 0,
    batch: async (db, cursor) => {
      const { data, error } = await after(db.from("films").select("id").or(BLANK("synopsis")).not("tmdb_id", "is", null).order("id").limit(10), cursor);
      if (error) throw error;
      const rows = data ?? [];
      return done(rows, 10, cursor, await inGroups(rows, 5, async (f) => {
        await importFilm(db, f.id);
        return !!(await db.from("films").select("synopsis").eq("id", f.id).single()).data?.synopsis;
      }));
    },
  },
  credits: {
    label: "Add full cast and crew", summary: "Adds everyone TMDB lists for each film, in billing order. Nothing already there changes.", unit: "films with new credits", tmdb: true,
    remaining: async (db) => (await db.from("films").select("id", { count: "exact", head: true }).not("tmdb_id", "is", null)).count ?? 0,
    batch: async (db, cursor) => {
      const { data, error } = await after(db.from("films").select("id, tmdb_id").not("tmdb_id", "is", null).order("id").limit(10), cursor);
      if (error) throw error;
      const rows = data ?? [];
      return done(rows, 10, cursor, await inGroups(rows, 5, (f) => refreshCredits(db, f.id, f.tmdb_id as number)));
    },
  },
  people: {
    label: "Fill people details", summary: "Biographies, birth and death dates, birthplace, IMDb and Instagram from TMDB.", unit: "people updated", tmdb: true,
    remaining: async (db) => (await db.from("people").select("id", { count: "exact", head: true }).not("tmdb_id", "is", null).is("details_at", null)).count ?? 0,
    batch: async (db, cursor) => {
      const { data, error } = await after(db.from("people").select("*").not("tmdb_id", "is", null).is("details_at", null).order("id").limit(20), cursor);
      if (error) throw error;
      const rows = (data ?? []) as { id: string }[];
      return done(rows, 20, cursor, await inGroups(rows, 10, (p) => fillPerson(db, p)));
    },
  },
  awards: {
    label: "Update awards", summary: "Wins and nominations from Wikidata, matched by each film's TMDB and IMDb ids.", unit: "films with awards", tmdb: false,
    remaining: async (db) => (await db.from("films").select("id", { count: "exact", head: true }).not("tmdb_id", "is", null)).count ?? 0,
    batch: async (db, cursor) => {
      const { data, error } = await after(db.from("films").select("id, slug, tmdb_id, year, awards").not("tmdb_id", "is", null).order("id").limit(6), cursor);
      if (error) throw error;
      const rows = data ?? [];
      const { updated, failed } = await refreshAwardsBatch(db, rows);
      return done(rows, 6, cursor, { changed: updated.length, failed });
    },
  },
  watch: {
    label: "Refresh where to watch", summary: "Checks TMDB again for every film's streaming, rental and purchase options. Links you added stay.", unit: "films refreshed", tmdb: true,
    remaining: async (db) => (await db.from("films").select("id", { count: "exact", head: true }).not("tmdb_id", "is", null)).count ?? 0,
    batch: async (db, cursor) => {
      const { data, error } = await after(db.from("films").select("id, tmdb_id, watch").not("tmdb_id", "is", null).order("id").limit(15), cursor);
      if (error) throw error;
      const rows = data ?? [];
      return done(rows, 15, cursor, await inGroups(rows, 5, async (f) => {
        const fresh = await getWatch(f.tmdb_id as number);
        const manual = ((f.watch ?? []) as WatchOption[]).filter((w) => !w.url.includes("themoviedb.org") && !w.url.includes("justwatch.com"));
        const { error } = await db.from("films").update({ watch: [...manual, ...fresh], updated_at: new Date().toISOString() }).eq("id", f.id);
        if (error) throw error;
        return true;
      }));
    },
  },
  extras: {
    label: "Fill extra details", summary: "Themes, age rating, series, title logo, stills, studios, tagline, budget, box office, recommendations and other titles from TMDB.", unit: "films filled", tmdb: true,
    remaining: async (db) => (await db.from("films").select("id", { count: "exact", head: true }).not("tmdb_id", "is", null)).count ?? 0,
    batch: async (db, cursor) => {
      const { data, error } = await after(db.from("films").select("id, tmdb_id, title, original_title, aka").not("tmdb_id", "is", null).order("id").limit(15), cursor);
      if (error) throw error;
      const rows = data ?? [];
      return done(rows, 15, cursor, await inGroups(rows, 5, (f) => fillExtras(db, f)));
    },
  },
  changes: {
    label: "Refresh changed films", summary: "Asks TMDB which films changed since this last ran (up to two weeks) and refreshes only those of ours: empty fields, cast and crew, where to watch and extra details.", unit: "films refreshed", tmdb: true,
    remaining: async (db) => {
      const w = await changesWindow(db);
      return (await getChanges(w.start, w.end, 1)).total;
    },
    // The cursor is "start|end|next page|pages".
    batch: async (db, cursor) => {
      let [start, end, page, pages] = (cursor ?? "").split("|") as [string, string, string, string];
      if (!cursor) {
        const w = await changesWindow(db);
        start = w.start; end = w.end; page = "1"; pages = String((await getChanges(start, end, 1)).pages);
      }
      const from = Number(page), last = Number(pages);
      const upto = Math.min(last, from + 9);
      const lists = await Promise.all(Array.from({ length: upto - from + 1 }, (_, i) => getChanges(start, end, from + i).then((r) => r.ids)));
      const ids = [...new Set(lists.flat())];
      const { data, error } = ids.length ? await db.from("films").select("id").in("tmdb_id", ids) : { data: [], error: null };
      if (error) throw error;
      const ours = (data ?? []) as { id: string }[];
      const counts = await inGroups(ours, 3, async (f) => { await importFilm(db, f.id); return true; });
      return { cursor: `${start}|${end}|${upto + 1}|${last}`, processed: ids.length, ...counts, done: upto >= last };
    },
  },
};

export const JOB_KINDS = Object.keys(JOBS) as JobKind[];
export const isJobKind = (value: unknown): value is JobKind => typeof value === "string" && value in JOBS;

/**
 * Works through running jobs until the time budget is spent. Each job is claimed with a lease, so
 * the worker and a Start button never run the same job at once. A job stopped from admin stops
 * after the batch in hand. Returns how many batches ran and whether anything changed.
 */
export async function runJobs(db: SupabaseClient, budgetMs: number, only?: string): Promise<{ batches: number; changed: number; finished: Job[] }> {
  const deadline = Date.now() + budgetMs;
  let q = db.from("admin_jobs").select("*").eq("status", "running").order("started_at");
  if (only) q = q.eq("id", only);
  const { data: running } = await q;
  let batches = 0, changed = 0;
  const finished: Job[] = [];
  const jobs = (running ?? []) as Job[];
  for (const [i, job] of jobs.entries()) {
    // Running jobs share the time: each gets an equal part of what's left.
    const share = (deadline - Date.now()) / (jobs.length - i);
    const until = Date.now() + share;
    const margin = Math.min(15_000, share / 2);
    const now = new Date().toISOString();
    const lease = new Date(Date.now() + share + 60_000).toISOString();
    const { data: claimed } = await db.from("admin_jobs").update({ locked_until: lease }).eq("id", job.id).eq("status", "running")
      .or(`locked_until.is.null,locked_until.lt."${now}"`).select("*").maybeSingle();
    if (!claimed) continue;
    let state = claimed as Job;
    let streak = 0;
    // A batch takes a few seconds; stop starting new ones when one more might not fit.
    while (Date.now() < until - margin) {
      let result: Batch;
      try {
        result = await JOBS[state.kind].batch(db, state.cursor);
        streak = 0;
      } catch (e) {
        streak++;
        result = { cursor: state.cursor, processed: 0, changed: 0, failed: 0, done: false, error: e instanceof Error ? e.message : String(e) };
      }
      batches++;
      changed += result.changed;
      const stamp = new Date().toISOString();
      // Three batches in a row that couldn't run at all (TMDB down, a bad key): stop and say why.
      const end = result.done ? "done" : streak >= 3 ? "failed" : null;
      const patch = {
        cursor: result.cursor, processed: state.processed + result.processed, changed: state.changed + result.changed,
        failed: state.failed + result.failed, last_error: result.error ?? state.last_error, updated_at: stamp,
        ...(end ? { status: end, finished_at: stamp, locked_until: null } : {}),
      };
      // Only while still running: if someone pressed Stop, this changes nothing and the loop ends.
      const { data: next } = await db.from("admin_jobs").update(patch).eq("id", state.id).eq("status", "running").select("*").maybeSingle();
      if (!next) break;
      state = next as Job;
      if (state.status !== "running") { finished.push(state); break; }
      if (result.error) await new Promise((r) => setTimeout(r, 2000));
    }
    if (state.status === "running") await db.from("admin_jobs").update({ locked_until: null }).eq("id", state.id).eq("status", "running");
  }
  return { batches, changed, finished };
}

/** Writes the finished job to the activity log, under whoever started it. */
export async function logFinishedJobs(db: SupabaseClient, jobs: Job[]) {
  if (!jobs.length) return;
  await db.from("admin_activity").insert(jobs.map((j) => ({
    actor_id: j.started_by, target_type: "job", target_id: j.id,
    action: `${j.status === "done" ? "Finished" : j.status === "failed" ? "Couldn’t finish" : "Stopped"}: ${JOBS[j.kind].label}`,
    details: `${j.processed.toLocaleString("en-US")} checked · ${j.changed.toLocaleString("en-US")} ${JOBS[j.kind].unit}${j.failed ? ` · ${j.failed.toLocaleString("en-US")} failed` : ""}`,
  })));
}
