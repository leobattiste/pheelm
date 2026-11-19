import "server-only";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { processQueue, type QueueItem } from "@/lib/film-queue";
import { tmdbEnabled } from "@/lib/tmdb";
import { workerAuthorized } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Scheduled job (every minute): adds the next 20 films from the queue and publishes them, oldest first. Films
 * TMDB couldn't match keep their reason in the queue and aren't retried; fix or remove them in
 * Admin → Films → Add.
 */
export async function POST(request: NextRequest) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = url && service ? createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  if (!(await workerAuthorized(request, db))) return json({ error: "Not allowed." }, 401);
  if (!db) return json({ error: "Supabase is not configured." }, 503);
  if (!tmdbEnabled) return json({ error: "TMDB_API_KEY is not set." }, 503);
  const limit = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 20));
  const { data: next, error } = await db.from("film_queue").select("id").is("last_error", null).order("created_at").limit(limit);
  if (error) return json({ error: error.message }, 500);
  // Claim the films first: only rows still unclaimed are updated, so runs that overlap never
  // add the same film twice. Each claimed film ends up added (and removed) or with its reason.
  const { data: claimed } = next?.length
    ? await db.from("film_queue").update({ last_error: "Adding…" }).in("id", next.map((r) => r.id)).is("last_error", null).select("*")
    : { data: [] };
  const items = (claimed ?? []) as QueueItem[];
  const results: Awaited<ReturnType<typeof processQueue>> = [];
  // Five at a time keeps TMDB and Wikidata comfortable.
  for (let i = 0; i < items.length; i += 5) results.push(...await processQueue(db, items.slice(i, i + 5), true));
  const added = results.filter((r) => r.status === "added").length;
  if (added) { revalidatePath("/", "layout"); revalidateTag("search-public", "max"); }
  const { count } = await db.from("film_queue").select("*", { count: "exact", head: true }).is("last_error", null);
  return json({ tried: items.length, added, unmatched: results.filter((r) => r.status === "not-found").length, waiting: count ?? 0 });
}
