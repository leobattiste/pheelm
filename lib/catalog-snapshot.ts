import "server-only";

import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { after } from "next/server";
import { anonClient, fetchCatalog } from "./data";
import { serviceClient } from "./supabase/service";

const KEEP = 3; // older snapshots kept for servers still downloading them

export type SnapshotResult =
  | { skipped: true; version: number }
  | { version: number; path: string; bytes: number; films: number; people: number; ms: number; replaced: boolean };

let running: Promise<SnapshotResult> | null = null;

/**
 * Writes the published catalog to Storage as one gzipped file and records it in catalog_snapshot
 * (see catalogSource in lib/data.ts). Skips when the snapshot already matches catalog_version,
 * unless forced. Rows are read with the public key, so the file holds what any visitor could read.
 * One rebuild at a time per server.
 */
export function rebuildCatalogSnapshot(force = false): Promise<SnapshotResult> {
  running ??= build(force).finally(() => { running = null; });
  return running;
}

async function build(force: boolean): Promise<SnapshotResult> {
  const admin = serviceClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  const anon = anonClient();

  // The version is read before the rows, so a change landing mid-read leaves the snapshot marked
  // older and the next rebuild picks it up.
  const [{ data: live, error }, { data: current }] = await Promise.all([
    anon.from("catalog_version").select("v").eq("id", 1).single(),
    admin.from("catalog_snapshot").select("version, path").eq("id", 1).maybeSingle(),
  ]);
  if (error || !live) throw new Error(`No catalog version: ${error?.message ?? "missing"}`);
  const version = Number(live.v);
  if (current && Number(current.version) >= version && !force) return { skipped: true, version };

  const started = Date.now();
  const raw = await fetchCatalog(anon);
  if (!raw.films.length || !raw.people.length) throw new Error("The catalog came back empty.");
  const body = gzipSync(Buffer.from(JSON.stringify(raw)), { level: 9 });
  const path = `v${version}-${createHash("sha256").update(body).digest("hex").slice(0, 10)}.json.gz`;

  const bucket = admin.storage.from("catalog");
  const up = await bucket.upload(path, body, { contentType: "application/gzip", cacheControl: "31536000", upsert: true });
  if (up.error) throw new Error(`Snapshot upload failed: ${up.error.message}`);
  // Recorded only over an older one: when two servers rebuild at once, the slower one can't put an
  // older snapshot back over a newer one.
  const row = { id: 1, version, path, built_at: new Date().toISOString() };
  const meta = current
    ? await admin.from("catalog_snapshot").update(row).eq("id", 1)[force ? "lte" : "lt"]("version", version).select("id")
    : await admin.from("catalog_snapshot").insert(row).select("id");
  if (meta.error && meta.error.code !== "23505") throw new Error(`Could not record the snapshot: ${meta.error.message}`);
  if (meta.error || !meta.data?.length) {
    // Someone else recorded the same or a newer version meanwhile: keep theirs, drop this file.
    const { data: now } = await admin.from("catalog_snapshot").select("path").eq("id", 1).maybeSingle();
    if (now && now.path !== path) await bucket.remove([path]);
    return { skipped: true, version };
  }

  const { data: files } = await bucket.list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  const old = (files ?? []).map((f) => f.name).filter((n) => n !== path).slice(KEEP - 1);
  if (old.length) await bucket.remove(old);
  return { version, path, bytes: body.length, films: raw.films.length, people: raw.people.length, ms: Date.now() - started, replaced: Boolean(current) };
}

/**
 * After an admin save or a worker's change, rebuild the snapshot once the response has gone.
 * Until it lands, servers read the tables directly, so the change shows straight away.
 */
export function queueCatalogSnapshot() {
  after(async () => {
    try {
      await rebuildCatalogSnapshot();
    } catch (e) {
      console.error(`⚠ Catalog snapshot rebuild failed: ${e instanceof Error ? e.message : e}`);
    }
  });
}
