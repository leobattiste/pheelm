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
async function load({ total, building }) {
  const out = await build({
    stdin: { contents: `export {getFilms} from './lib/data';`, loader: "ts", resolveDir: process.cwd() },
    bundle: true, write: false, format: "cjs", platform: "node",
    external: ["server-only", "@supabase/supabase-js", "next/cache", "react"],
  });
  const stats = { requests: 0, peak: 0, inFlight: 0, reads: 0 };
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
    "@supabase/supabase-js": { createClient: () => { stats.reads++; return { from: () => makeQuery() }; } },
    "next/cache": { unstable_cache: (fn) => fn, revalidateTag: () => {} },
    react: { cache: (fn) => fn },
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
    require: (name) => fakes[name] ?? require(name),
  });
  return { getFilms: mod.exports.getFilms, stats, clock };
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

console.log("ok  the catalogue is read a few pages at a time, and once per build");
