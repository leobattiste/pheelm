import "server-only";

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { importFilm } from "@/lib/import";
import { serviceClient } from "@/lib/supabase/service";
import { workerCheck } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Fills in what published films are missing — a poster, a synopsis — from TMDB: POST ?limit=20.
 * `importFilm` only writes fields that are empty, so nothing edited by hand is overwritten.
 */
export async function POST(request: NextRequest) {
  const db = serviceClient();
  const check = await workerCheck(request, db);
  if (check !== "ok") return json({ error: "Not allowed.", reason: check }, 401);
  if (!db) return json({ error: "Supabase is not configured." }, 503);
  const limit = Math.min(40, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 20));

  const { data, error } = await db
    .from("films")
    .select("id, title, slug")
    .eq("status", "published")
    .or("poster_url.is.null,synopsis.is.null")
    .order("created_at")
    .limit(limit);
  if (error) return json({ error: error.message }, 500);
  const films = data ?? [];

  // A few at a time: each film costs several TMDB calls.
  const done: string[] = [];
  const failed: string[] = [];
  for (let i = 0; i < films.length; i += 4) {
    await Promise.all(films.slice(i, i + 4).map(async (f) => {
      try {
        await importFilm(db, f.id);
        done.push(f.title);
        if (f.slug) revalidatePath(`/films/${f.slug}`);
      } catch (e) {
        failed.push(`${f.title}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }));
  }

  const { count: left } = await db.from("films").select("*", { count: "exact", head: true })
    .eq("status", "published").or("poster_url.is.null,synopsis.is.null");
  if (done.length) revalidatePath("/", "layout");
  return json({ tried: films.length, filled: done.length, failed, remaining: left ?? 0 });
}
