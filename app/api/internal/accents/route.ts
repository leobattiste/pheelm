import "server-only";

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { posterAccent } from "@/lib/import";
import { serviceClient } from "@/lib/supabase/service";
import { workerCheck } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Measures the accent of published films that don't have one yet: POST ?limit=40.
 *
 * Only the poster is read — the address is already stored, so there are no TMDB calls here and
 * nothing else about the film is touched. Runs can be given different slices with `offset` so
 * several work through the catalog at once.
 */
export async function POST(request: NextRequest) {
  const db = serviceClient();
  const check = await workerCheck(request, db);
  if (check !== "ok") return json({ error: "Not allowed.", reason: check }, 401);
  if (!db) return json({ error: "Supabase is not configured." }, 503);
  const limit = Math.min(120, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 40));
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset")) || 0);

  const { data, error } = await db
    .from("films")
    .select("id, title, slug, poster_url")
    .eq("status", "published")
    .is("accent", null)
    .not("poster_url", "is", null)
    .order("created_at")
    .range(offset, offset + limit - 1);
  if (error) return json({ error: error.message }, 500);
  const films = (data ?? []) as { id: string; title: string; slug: string | null; poster_url: string }[];

  // Eight at a time: one image download and a resize each.
  let measured = 0, colourless = 0;
  const failed: string[] = [];
  for (let i = 0; i < films.length; i += 8) {
    await Promise.all(films.slice(i, i + 8).map(async (f) => {
      try {
        const accent = await posterAccent(f.poster_url);
        // A poster with no colour in it is left null, and its page stays neutral.
        if (!accent) { colourless++; return; }
        const { error: upErr } = await db.from("films").update({ accent }).eq("id", f.id);
        if (upErr) { failed.push(`${f.title}: ${upErr.message}`); return; }
        measured++;
        if (f.slug) revalidatePath(`/films/${f.slug}`);
      } catch (e) {
        failed.push(`${f.title}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }));
  }

  const { count: left } = await db.from("films").select("*", { count: "exact", head: true })
    .eq("status", "published").is("accent", null).not("poster_url", "is", null);
  return json({ tried: films.length, measured, colourless, failed: failed.slice(0, 10), remaining: left ?? 0 });
}
