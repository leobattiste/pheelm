// A build that cannot read the catalogue must stop, not quietly publish the starter catalogue.
import { build } from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';

/** Loads lib/data.ts with Supabase replaced by `rows`, or by a failure when it is an Error. */
async function loadCatalogModule(rows, { building }) {
  const out = await build({
    stdin: { contents: `export {getFilms} from './lib/data';`, loader: 'ts', resolveDir: process.cwd() },
    bundle: true, write: false, format: 'cjs', platform: 'node',
    external: ['server-only', '@supabase/supabase-js', 'next/cache', 'react'],
  });
  const answer = () => rows instanceof Error ? Promise.reject(rows) : Promise.resolve({ data: rows, error: null, count: rows.length });
  // A chainable stand-in for the query builder: every step returns itself, and awaiting it answers.
  const query = { select: () => query, eq: () => query, order: () => query, range: () => query,
    then: (resolve, reject) => answer().then(resolve, reject) };
  const fakes = {
    'server-only': {},
    '@supabase/supabase-js': { createClient: () => ({ from: () => query }) },
    'next/cache': { unstable_cache: (fn) => fn, revalidateTag: () => {} },
    react: { cache: (fn) => fn },
  };
  const mod = { exports: {} };
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key' };
  if (building) env.NEXT_PHASE = 'phase-production-build'; else delete env.NEXT_PHASE;
  vm.runInNewContext(out.outputFiles[0].text, {
    module: mod, exports: mod.exports, console, TextEncoder, TextDecoder,
    process: { ...process, env },
    require: (name) => fakes[name] ?? require(name),
  });
  return mod.exports;
}

const starterSize = JSON.parse((await import('node:fs')).readFileSync('data/catalog.json', 'utf8')).films.length;

// 1. The database is unreachable while building: stop, so the previous deploy keeps serving.
{
  const { getFilms } = await loadCatalogModule(new Error('connection refused'), { building: true });
  await assert.rejects(getFilms(), /connection refused/, 'a build with no database must fail');
}

// 2. The database answers, but with nothing: also a broken deploy, not a fresh install.
{
  const { getFilms } = await loadCatalogModule([], { building: true });
  await assert.rejects(getFilms(), /no published films/, 'a build with an empty catalogue must fail');
}

// 3. Outside a build the site keeps working: a running server holds on to the last good pages,
//    and a developer without a database still gets the starter catalogue.
{
  const { getFilms } = await loadCatalogModule(new Error('connection refused'), { building: false });
  await assert.rejects(getFilms(), /connection refused/, 'the live site surfaces the failure rather than faking data');
}
{
  const { getFilms } = await loadCatalogModule([], { building: false });
  const films = await getFilms();
  assert.equal(films.length, starterSize, 'locally, an empty database falls back to the starter catalogue');
}

console.log('PASS: builds stop on a database failure or an empty catalogue; local development still falls back');
