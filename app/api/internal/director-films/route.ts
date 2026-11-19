import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { getDirectedMovies, tmdbEnabled } from "@/lib/tmdb";
import { workerCheck } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Queues the films that the given directors made and Pheelm doesn't have yet. Body:
 * { directors: [{ tmdb_id, name }] }. The film queue job then adds them, checking each against
 * the director on TMDB. Only for directors already confirmed for the directory.
 */
export async function POST(request: NextRequest) {
  const db = serviceClient();
  const check = await workerCheck(request, db);
  if (check !== "ok") return json({ error: "Not allowed.", reason: check }, 401);
  if (!db) return json({ error: "Supabase is not configured." }, 503);
  if (!tmdbEnabled) return json({ error: "TMDB_API_KEY is not set." }, 503);
  const body = await request.json().catch(() => ({})) as { directors?: { tmdb_id?: unknown; name?: unknown }[] };
  const directors = (body.directors ?? []).flatMap((d) => Number.isInteger(d.tmdb_id) && typeof d.name === "string" ? [{ tmdb_id: d.tmdb_id as number, name: d.name.slice(0, 200) }] : []).slice(0, 25);
  let queued = 0, found = 0;
  const failed: string[] = [];
  for (const d of directors) {
    try {
      const films = await getDirectedMovies(d.tmdb_id);
      if (!films.length) continue;
      const { data: have } = await db.from("films").select("tmdb_id").in("tmdb_id", films.map((f) => f.id));
      const known = new Set((have ?? []).map((r) => r.tmdb_id));
      const missing = films.filter((f) => !known.has(f.id));
      found += missing.length;
      for (const f of missing) {
        // The queue's unique title-and-year rule skips films already waiting.
        const { error } = await db.from("film_queue").insert({ title: f.title.slice(0, 300), year: f.year, director_name: d.name, director_keys: [d.name] });
        if (!error) queued++;
      }
    } catch {
      failed.push(d.name);
    }
  }
  return json({ directors: directors.length, found, queued, failed });
}
