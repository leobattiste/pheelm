import "server-only";

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { getPersonDetails } from "@/lib/tmdb";
import { workerCheck } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Adds missing director portraits from TMDB: POST ?limit=100. Only directors with a TMDB id and no
 * portrait are tried, each once (photo_checked_at); a portrait that is already there is never replaced.
 */
export async function POST(request: NextRequest) {
  const db = serviceClient();
  const check = await workerCheck(request, db);
  if (check !== "ok") return json({ error: "Not allowed.", reason: check }, 401);
  if (!db) return json({ error: "Supabase is not configured." }, 503);
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 100));

  const todo = () => db.from("people").select("id, name, tmdb_id")
    .eq("in_directory", true).not("tmdb_id", "is", null).is("photo_checked_at", null).or("photo_url.is.null,photo_url.eq.");
  const { data, error } = await todo().order("id").limit(limit);
  if (error) return json({ error: error.message }, 500);
  const people = data ?? [];

  let filled = 0;
  const failed: string[] = [];
  for (let i = 0; i < people.length; i += 8) {
    await Promise.all(people.slice(i, i + 8).map(async (p) => {
      try {
        // A person TMDB no longer has (404) counts as checked; any other error leaves them for a later run.
        const { photo_url } = await getPersonDetails(p.tmdb_id as number).catch((e: unknown) => {
          if (/\b404\b/.test(String(e instanceof Error ? e.message : e))) return { photo_url: null };
          throw e;
        });
        const patch: Record<string, unknown> = { photo_checked_at: new Date().toISOString() };
        if (photo_url) patch.photo_url = photo_url;
        const { error: e } = await db.from("people").update(patch).eq("id", p.id);
        if (e) throw new Error(e.message);
        if (photo_url) filled++;
      } catch (e) {
        // The person stays unchecked and a later run tries again.
        failed.push(`${p.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }));
  }

  const { data: more } = await todo().limit(1);
  if (filled) { revalidatePath("/directors"); revalidatePath("/", "layout"); }
  return json({ tried: people.length, filled, failed: failed.slice(0, 10), failedCount: failed.length, more: (more ?? []).length > 0 });
}
