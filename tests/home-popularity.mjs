import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helperSource = compile('lib/home-popularity.ts');
function loadHelper({ enabled = true, getPage, signalFactory = AbortSignal }) {
  const exports = {};
  const cacheCalls = [];
  const cached = (fn, keys, options) => {
    cacheCalls.push({ keys, options });
    let value;
    return () => value ??= fn().catch(error => { value = undefined; throw error; });
  };
  vm.runInNewContext(helperSource, { exports, AbortSignal: signalFactory, require(name) {
    if (name === 'server-only') return {};
    if (name === 'next/cache') return { unstable_cache: cached };
    if (name === './tmdb') return { tmdbEnabled: enabled, getPopularMoviesPage: getPage };
    throw Error(`Unexpected dependency: ${name}`);
  } });
  return { ...exports, cacheCalls };
}

let active = 0;
let highestConcurrency = 0;
const calls = [];
const deadlines = [];
const helper = loadHelper({ getPage: async (page, signal) => {
  calls.push(page);
  deadlines.push(signal);
  highestConcurrency = Math.max(highestConcurrency, ++active);
  // Resolve adjacent pages out of order; the result must retain worldwide chart order.
  await new Promise(resolve => setTimeout(resolve, page % 2 ? 1 : 3));
  active--;
  return { page, total_pages: 500, results: [{ id: page * 10, popularity: 1000 - page }, { id: 10, popularity: 1 }] };
} });
const ids = await helper.getPopularMovieIds();
assert.deepEqual(Array.from(ids), Array.from({ length: 20 }, (_, i) => (i + 1) * 10), 'preserves page order and removes duplicate IDs');
assert.equal(calls.length, 20, 'global chart fetch is capped regardless of catalog size or TMDB total pages');
assert.ok(highestConcurrency <= 4, 'requests are concurrency bounded');
assert.ok(deadlines[0] instanceof AbortSignal);
assert.ok(deadlines.every(signal => signal === deadlines[0]), 'one shared deadline covers the entire chart refresh, rather than restarting per page');
assert.equal(helper.cacheCalls[0].options.revalidate, 21600, 'chart is shared for six hours');
await helper.getPopularMovieIds();
assert.equal(calls.length, 20, 'repeated homepage reads reuse the cached global chart');

const shortCalls = [];
const short = loadHelper({ getPage: async page => {
  shortCalls.push(page);
  return { page, total_pages: 2, results: [{ id: page }] };
} });
assert.deepEqual(Array.from(await short.getPopularMovieIds()), [1, 2]);
assert.deepEqual(shortCalls, [1, 2], 'honors a shorter chart');
const disabled = loadHelper({ enabled: false, getPage: () => { throw Error('must not request'); } });
assert.deepEqual(Array.from(await disabled.getPopularMovieIds()), [], 'missing existing TMDB credentials produces no fabricated ranking');
let attempts = 0;
const failure = loadHelper({ getPage: async () => { attempts++; throw Error('API unavailable'); } });
assert.deepEqual(Array.from(await failure.getPopularMovieIds()), []);
await failure.getPopularMovieIds();
assert.equal(attempts, 2, 'a failed refresh is not cached as a successful empty chart');
const malformed = loadHelper({ getPage: async () => ({ results: null, total_pages: 2 }) });
assert.deepEqual(Array.from(await malformed.getPopularMovieIds()), [], 'incomplete upstream data fails safely');
const timeouts = [];
const expired = new AbortController();
expired.abort();
const timedOut = loadHelper({
  signalFactory: { timeout(ms) { timeouts.push(ms); return expired.signal; } },
  getPage: async (_page, signal) => { signal.throwIfAborted(); throw Error('unreachable'); },
});
assert.deepEqual(Array.from(await timedOut.getPopularMovieIds()), [], 'an expired shared deadline fails safely');
assert.deepEqual(timeouts, [6000], 'a chart refresh creates exactly one six-second deadline');

// Exercise the actual TMDB request helper without a live key or network.
const tmdb = {};
const requests = [];
vm.runInNewContext(compile('lib/tmdb.ts'), {
  exports: tmdb, URL, AbortSignal, process: { env: { TMDB_API_KEY: 'fixture-key' } },
  require(name) { if (name === 'server-only') return {}; throw Error(`Unexpected dependency: ${name}`); },
  fetch: async (url, options) => {
    options.signal?.throwIfAborted();
    requests.push({ url, options });
    return { status: 200, ok: true, json: async () => ({ page: 3, total_pages: 10, results: [{ id: 7, popularity: 42 }] }) };
  },
});
await tmdb.getPopularMoviesPage(3);
assert.equal(requests[0].url.pathname, '/3/movie/popular');
assert.equal(requests[0].url.searchParams.get('page'), '3');
assert.equal(requests[0].url.searchParams.has('region'), false, 'worldwide popularity is not filtered to one country');
assert.equal(requests[0].url.searchParams.get('language'), 'en-US', 'language controls display text only');
assert.ok(requests[0].options.signal instanceof AbortSignal, 'upstream request has a timeout signal');
const sharedDeadline = AbortSignal.timeout(6000);
await tmdb.getPopularMoviesPage(4, sharedDeadline);
assert.equal(requests[1].options.signal, sharedDeadline, 'TMDB request preserves a caller-supplied deadline');
await assert.rejects(tmdb.getPopularMoviesPage(5, expired.signal), 'TMDB request respects an already-aborted chart deadline');
console.log('PASS: worldwide TMDB endpoint, six-hour cache, bounded pagination/concurrency, ordered IDs, missing-key/outage behavior, and catalog-independent cost');
