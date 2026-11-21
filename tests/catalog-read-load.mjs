// A build reads the catalogue from Supabase. With 31,000 credits that read is the heaviest thing
// the site does, and asking for every page at once, several times per build, is what made the
// database answer "canceling statement due to statement timeout" and fail the deploy. These
// checks hold the two limits that keep it civil.
import { build } from "esbuild";
import vm from "node:vm";
import assert from "node:assert/strict";

const AT_ONCE = 4;

/**
 * Loads lib/data.ts with Supabase replaced by a stand-in that counts requests, records how many
 * were in flight at once, and answers `total` rows a thousand at a time.
 */
// An in-memory temp folder, so build processes can be made to share one (or not).
function memoryDisk() {
  const files = new Map();
  const missing = () => Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
  return {
    files,
    promises: {
      stat: (f) => files.has(f) ? Promise.resolve({ mtimeMs: files.get(f).at }) : missing(),
      readFile: (f) => files.has(f) ? Promise.resolve(files.get(f).text) : missing(),
      writeFile: (f, text) => { files.set(f, { text, at: Date.now() }); return Promise.resolve(); },
      rename: (a, b) => { files.set(b, files.get(a)); files.delete(a); return Promise.resolve(); },
      rm: (f) => { files.delete(f); return Promise.resolve(); },
      open: (f) => files.has(f) ? Promise.reject(Object.assign(new Error("EEXIST"), { code: "EEXIST" })) : (files.set(f, { text: "", at: Date.now() }), Promise.resolve({ close: () => Promise.resolve() })),
    },
  };
}

async function load({ total, building, versioned = false, disk = memoryDisk() }) {
  const out = await build({
    stdin: { contents: `export {getFilms, getFilmCards, directorPageCatalog} from './lib/data';`, loader: "ts", resolveDir: process.cwd() },
    bundle: true, write: false, format: "cjs", platform: "node",
    external: ["server-only", "@supabase/supabase-js", "next/cache", "react"],
  });
  const stats = { requests: 0, peak: 0, inFlight: 0, reads: 0, versionChecks: 0, tables: [] };
  // `version` is the catalog_version row; `failing` makes every catalog request error.
  const db = { version: 1, failing: false };
  const versionQuery = () => {
    const q = {
      select: () => q, eq: () => q,
      maybeSingle: async () => {
        stats.versionChecks++;
        return versioned ? { data: { v: db.version }, error: null } : { data: null, error: { message: "relation does not exist" } };
      },
    };
    return q;
  };
  const makeQuery = () => {
    let from = 0, to = 999;
    const q = {
      select: () => q, eq: () => q, in: () => q, is: () => q, not: () => q,
      order: () => q,
      range: (a, b) => { from = a; to = b; return q; },
      then(resolve, reject) {
        stats.requests++;
        stats.inFlight++;
        stats.peak = Math.max(stats.peak, stats.inFlight);
        // Answers on a later tick, so overlapping requests really do overlap.
        return new Promise((r) => setTimeout(r, 5)).then(() => {
          stats.inFlight--;
          if (db.failing) return { data: null, error: { message: "canceling statement due to statement timeout" }, count: null };
          const count = Math.max(0, Math.min(to, total - 1) - from + 1);
          const rows = Array.from({ length: count }, (_, i) => ({
            id: `row-${from + i}`, slug: `f-${from + i}`, title: `Film ${from + i}`, year: 2000,
            status: "published", countries: [], languages: [], genres: [], aka: [],
          }));
          return { data: rows, error: null, count: total };
        }).then(resolve, reject);
      },
    };
    return q;
  };
  const fakes = {
    "server-only": {},
    "@supabase/supabase-js": { createClient: () => { stats.reads++; return { from: (t) => { stats.tables.push(t); return t === "catalog_version" ? versionQuery() : makeQuery(); } }; } },
    "next/cache": { unstable_cache: (fn) => fn, revalidateTag: () => {} },
    react: { cache: (fn) => fn },
    "node:fs": { promises: disk.promises },
    "node:os": { tmpdir: () => "/tmp" },
    "node:path": { join: (...p) => p.join("/") },
  };
  const mod = { exports: {} };
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" };
  if (building) env.NEXT_PHASE = "phase-production-build"; else delete env.NEXT_PHASE;
  // The module runs in its own realm with its own Date, so the clock it reads is handed in here;
  // patching Date.now out here would not reach it.
  const clock = { skip: 0 };
  class ClockDate extends Date {}
  ClockDate.now = () => Date.now() + clock.skip;
  vm.runInNewContext(out.outputFiles[0].text, {
    module: mod, exports: mod.exports, console, TextEncoder, TextDecoder, setTimeout, clearTimeout, Promise,
    Date: ClockDate,
    process: { ...process, env },
    require: (name) => { if (name in fakes) return fakes[name]; throw new Error(`unexpected require: ${name}`); },
  });
  return { getFilms: mod.exports.getFilms, getFilmCards: mod.exports.getFilmCards, directorPageCatalog: mod.exports.directorPageCatalog, stats, clock, db };
}

// 1. Pages are asked for a few at a time, not all at once.
{
  const { getFilms, stats } = await load({ total: 31_000, building: true });
  await getFilms();
  assert.ok(stats.requests > 30, `a 31,000-row table should take more than 30 pages, took ${stats.requests}`);
  assert.ok(stats.peak <= AT_ONCE, `at most ${AT_ONCE} requests should be in flight at once, saw ${stats.peak}`);
}

// 2. Every row arrives: reading politely must not drop or repeat any.
{
  const { getFilms } = await load({ total: 2_500, building: true });
  const films = await getFilms();
  assert.equal(films.length, 2_500, "every row should be read");
  assert.equal(new Set(films.map((f) => f.id)).size, 2_500, "no row should be read twice");
}

// 3. Nothing changes while the site builds, so one copy serves the whole build however long it
//    takes. Refreshing every minute meant reading the whole catalogue several times per deploy.
{
  const { getFilms, stats, clock } = await load({ total: 1_200, building: true });
  await getFilms();
  const afterFirst = stats.requests;
  clock.skip = 10 * 60_000; // ten minutes later, still the same build
  await getFilms();
  assert.equal(stats.requests, afterFirst, "a build should read the catalogue once, not again ten minutes in");
}

// 4. A running site still refreshes, or an admin's save would never show.
{
  const { getFilms, stats, clock } = await load({ total: 1_200, building: false });
  await getFilms();
  const afterFirst = stats.requests;
  clock.skip = 10 * 60_000;
  await getFilms();
  assert.ok(stats.requests > afterFirst, "a live site should read again once its copy is stale");
}

// 5. A running site whose catalogue hasn't changed asks for one row, not the whole catalogue.
//    Re-reading everything every minute after an admin save is what overloaded the database.
{
  const { getFilms, stats, clock } = await load({ total: 1_200, building: false, versioned: true });
  await getFilms();
  const afterFirst = stats.requests;
  for (const minutes of [2, 5, 10, 20]) {
    clock.skip = minutes * 60_000;
    await Promise.all([getFilms(), getFilms(), getFilms()]);
  }
  assert.equal(stats.requests, afterFirst, "an unchanged catalogue should not be read again");
  assert.ok(stats.versionChecks <= 5, `pages arriving together should share one check, saw ${stats.versionChecks}`);
}

// 6. When the catalogue changes, the next check reads it again, so an admin's save still shows.
{
  const { getFilms, stats, clock, db } = await load({ total: 1_200, building: false, versioned: true });
  await getFilms();
  const afterFirst = stats.requests;
  db.version++;
  clock.skip = 2 * 60_000;
  await getFilms();
  assert.ok(stats.requests > afterFirst, "a changed catalogue should be read again");
}

// 7. However quiet the catalogue, a copy is read afresh after half an hour.
{
  const { getFilms, stats, clock } = await load({ total: 1_200, building: false, versioned: true });
  await getFilms();
  const afterFirst = stats.requests;
  clock.skip = 31 * 60_000;
  await getFilms();
  assert.ok(stats.requests > afterFirst, "a copy should not outlive half an hour");
}

// 8. When a refresh fails on the live site, the last good copy keeps serving instead of an error,
//    and the database isn't asked again on every page until a minute has passed.
{
  const { getFilms, stats, clock, db } = await load({ total: 1_200, building: false, versioned: true });
  const first = await getFilms();
  db.version++;
  db.failing = true;
  clock.skip = 2 * 60_000;
  const during = await getFilms();
  assert.equal(during.length, first.length, "the last good catalogue should still be served");
  const afterFailure = stats.requests;
  await getFilms();
  await getFilms();
  assert.equal(stats.requests, afterFailure, "a failed refresh should wait a minute before trying again");
  db.failing = false;
  clock.skip = 4 * 60_000;
  await getFilms();
  assert.ok(stats.requests > afterFailure, "it should try again after a minute");
}

// 9. A failed read during a build still stops the build rather than shipping a broken catalogue.
{
  const { getFilms, db } = await load({ total: 1_200, building: true, versioned: true });
  db.failing = true;
  await assert.rejects(getFilms(), /statement timeout/);
}

// 10. A watchlist page needs a few dozen films, not the catalogue. On a server that holds no copy
//     it reads only those films, their director credits and those directors: no collections, no
//     other tables, a handful of requests. (Before, every visit read all five tables.)
{
  const { getFilmCards, stats } = await load({ total: 3, building: false, versioned: true });
  const cards = await getFilmCards(["row-0", "row-1", "row-1"]);
  assert.ok(cards.length >= 1 && cards[0].id && cards[0].slug, "should return film cards");
  const tables = new Set(stats.tables.filter((t) => t !== "catalog_version"));
  assert.ok([...tables].every((t) => ["films", "credits", "people"].includes(t)), "only films, credits and people");
  assert.ok(!tables.has("collections") && !tables.has("collection_films"), "should not read collections");
  assert.ok(stats.requests <= 4, `a small watchlist should take a few requests, saw ${stats.requests}`);
}

// 11. Two hundred films per request, asked for together, so a big watchlist doesn't wait in line.
{
  const { getFilmCards, stats } = await load({ total: 3, building: false, versioned: true });
  await getFilmCards(Array.from({ length: 450 }, (_, i) => `row-${i}`));
  const filmReads = stats.tables.filter((t) => t === "films").length;
  assert.equal(filmReads, 3, "450 films should be three requests of at most 200");
}

// 12. Nothing to show, nothing to ask.
{
  const { getFilmCards, stats } = await load({ total: 3, building: false, versioned: true });
  assert.equal((await getFilmCards([])).length, 0);
  assert.equal(stats.requests, 0, "an empty watchlist should make no requests");
}

// 13. A server that already holds the catalogue answers from it, with no further requests.
{
  const { getFilms, getFilmCards, stats } = await load({ total: 5, building: false, versioned: true });
  await getFilms();
  const afterFirst = stats.requests;
  const cards = await getFilmCards(["row-0", "row-3", "row-99"]);
  assert.equal(stats.requests, afterFirst, "a warm server should not read again");
  assert.equal(JSON.stringify(cards.map((c) => c.id)), JSON.stringify(["row-0", "row-3"]), "unknown films are left out");
}

// 14. A director page reads that director, their credits, those films with their credits and
//     those people: no collections, a handful of requests. (Before, it read the whole catalogue.)
{
  const { directorPageCatalog, stats } = await load({ total: 3, building: false, versioned: true });
  await directorPageCatalog("f-0");
  const tables = new Set(stats.tables.filter((t) => t !== "catalog_version"));
  assert.ok([...tables].every((t) => ["films", "credits", "people"].includes(t)), "only films, credits and people");
  assert.ok(stats.requests <= 6, `a director page should take a few requests, saw ${stats.requests}`);
}

// 15. A server that already holds the catalogue answers a director page from it.
{
  const { getFilms, directorPageCatalog, stats } = await load({ total: 5, building: false, versioned: true });
  await getFilms();
  const afterFirst = stats.requests;
  await directorPageCatalog("f-0");
  assert.equal(stats.requests, afterFirst, "a warm server should not read again");
}

// 16. Build processes share one download: the first leaves a copy, the next reads it and asks the
//     database for nothing.
{
  const disk = memoryDisk();
  const first = await load({ total: 3, building: true, disk });
  await first.getFilms();
  assert.ok(first.stats.requests > 0, "the first build process downloads the catalogue");
  const second = await load({ total: 3, building: true, disk });
  const films = await second.getFilms();
  assert.equal(second.stats.requests, 0, "the second build process should read the shared copy");
  assert.equal(films.length, (await first.getFilms()).length, "the shared copy holds the same films");
}

console.log("ok  the catalogue is read a few pages at a time, once per build, and again only when it changes");
