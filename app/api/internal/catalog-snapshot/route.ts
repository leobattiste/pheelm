import "server-only";

import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { fetchCatalog } from "@/lib/data";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { serviceClient } from "@/lib/supabase/service";
import { workerCheck } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const KEEP = 3; // older snapshots kept for servers still reading them
const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Rebuilds the catalog snapshot (see catalogSource in lib/data.ts) when catalog_version has moved:
 * POST, or POST ?force=1 to rebuild anyway. Runs every minute from pg_cron. The rows are read with
 * the public key, so the file holds exactly what any visitor could read.
 */
export async function POST(request: NextRequest) {
  const admin = serviceClient();
  const check = await workerCheck(request, admin);
  if (check !== "ok") return json({ error: "Not allowed.", reason: check }, 401);
  if (!admin) return json({ error: "Supabase is not configured." }, 503);
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  // The version is read before the rows, so a change landing mid-read is picked up next minute.
  const [{ data: live, error: vError }, { data: current }] = await Promise.all([
    anon.from("catalog_version").select("v").eq("id", 1).single(),
    admin.from("catalog_snapshot").select("version, path").eq("id", 1).maybeSingle(),
  ]);
  if (vError || !live) return json({ error: `No catalog version: ${vError?.message ?? "missing"}` }, 500);
  const version = Number(live.v);
  const force = request.nextUrl.searchParams.get("force") === "1";
  if (current && Number(current.version) === version && !force) return json({ skipped: true, version });

  const started = Date.now();
  const raw = await fetchCatalog(anon);
  if (!raw.films.length || !raw.people.length) return json({ error: "The catalog came back empty." }, 500);
  const body = gzipSync(Buffer.from(JSON.stringify(raw)), { level: 9 });
  const path = `v${version}-${createHash("sha256").update(body).digest("hex").slice(0, 10)}.json.gz`;

  const bucket = admin.storage.from("catalog");
  const { error: upError } = await bucket.upload(path, body, { contentType: "application/gzip", cacheControl: "31536000", upsert: true });
  if (upError) return json({ error: `Upload failed: ${upError.message}` }, 500);
  const { error: metaError } = await admin.from("catalog_snapshot").upsert({ id: 1, version, path, built_at: new Date().toISOString() });
  if (metaError) return json({ error: `Could not record the snapshot: ${metaError.message}` }, 500);

  // Old files go once newer ones are in place; a server mid-download keeps the last few.
  const { data: files } = await bucket.list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  const old = (files ?? []).map((f) => f.name).filter((n) => n !== path).slice(KEEP - 1);
  if (old.length) await bucket.remove(old);

  // Pages re-render from the new snapshot (an admin save may have refreshed them a moment early).
  if (current) revalidatePath("/", "layout");
  return json({ version, path, bytes: body.length, films: raw.films.length, people: raw.people.length, ms: Date.now() - started, removed: old.length });
}
