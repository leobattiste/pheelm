import "server-only";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { refreshAwardsBatch } from "@/lib/awards";
import { workerAuthorized } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Updates a slice of films' awards from Wikidata: POST ?offset=0&limit=20. */
export async function POST(request: NextRequest) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = url && service ? createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  if (!(await workerAuthorized(request, db))) return json({ error: "Not allowed." }, 401);
  if (!db) return json({ error: "Supabase is not configured." }, 503);
  const params = request.nextUrl.searchParams;
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const limit = Math.min(40, Math.max(1, Number(params.get("limit")) || 20));
  const { count } = await db.from("films").select("*", { count: "exact", head: true }).not("tmdb_id", "is", null);
  const { data, error } = await db.from("films").select("id, slug, tmdb_id, year, awards").not("tmdb_id", "is", null).order("id").range(offset, offset + limit - 1);
  if (error) return json({ error: error.message }, 500);
  const updated = await refreshAwardsBatch(db, data ?? []);
  for (const f of updated) if (f.slug) revalidatePath(`/films/${f.slug}`);
  const next = offset + (data?.length ?? 0);
  if (next >= (count ?? 0)) revalidatePath("/", "layout");
  return json({ checked: data?.length ?? 0, updated: updated.length, next, total: count ?? 0 });
}
