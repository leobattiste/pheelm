// Background admin jobs (lib/jobs.ts): a job is claimed by one runner at a time, works through
// batches until it's done, stops when an admin presses Stop, gives up after three failed batches
// in a row, and running jobs share the time. Uses an in-memory database; no Supabase needed.
// Run: node tests/admin-jobs.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const source = ts.transpileModule(readFileSync(resolve(root, 'lib/jobs.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const stub = { 'server-only': {}, '@/lib/awards': { refreshAwardsBatch: async () => ({ updated: [], failed: 0 }) }, '@/lib/import': { fillPerson: async () => true, importFilm: async () => '', refreshCredits: async () => 0 }, '@/lib/tmdb': { getWatch: async () => [] } };
const module = { exports: {} };
new Function('module', 'exports', 'require', source)(module, module.exports, (id) => { if (id in stub) return stub[id]; throw Error('Unexpected import ' + id); });
const { JOBS, runJobs } = module.exports;

// A tiny stand-in for the Supabase client: enough of select / update / eq / or / order / maybeSingle.
function fakeDb(rows) {
  const matches = (row, filters) => filters.every((f) => f(row));
  return {
    rows,
    from(table) {
      assert.equal(table, 'admin_jobs');
      const filters = []; let patch = null; let single = false;
      const q = {
        select() { return q; }, order() { return q; },
        eq(col, val) { filters.push((r) => r[col] === val); return q; },
        or(expr) {
          // locked_until.is.null,locked_until.lt."<iso>"
          const until = expr.match(/lt\."([^"]+)"/)[1];
          filters.push((r) => r.locked_until === null || r.locked_until < until); return q;
        },
        update(p) { patch = p; return q; },
        maybeSingle() { single = true; return q; },
        then(resolve) {
          const hit = rows.filter((r) => matches(r, filters));
          if (patch) for (const r of hit) Object.assign(r, patch);
          const data = single ? (hit[0] ? { ...hit[0] } : null) : hit.map((r) => ({ ...r }));
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return q;
    },
  };
}
const job = (over) => ({ id: over.id, kind: over.kind ?? 'awards', status: 'running', cursor: null, total: 30, processed: 0, changed: 0, failed: 0, last_error: null, started_by: 'admin', started_at: over.started_at ?? '2026-11-27T10:00:00Z', updated_at: '', finished_at: null, locked_until: null, ...over });

// 1. A job runs batch after batch until its records run out, then is done and unlocked.
{
  let calls = 0;
  JOBS.awards.batch = async (_db, cursor) => { calls++; const n = Number(cursor ?? 0); return { cursor: String(n + 10), processed: 10, changed: 3, failed: n === 10 ? 1 : 0, done: n + 10 >= 30 }; };
  const db = fakeDb([job({ id: 'a' })]);
  const out = await runJobs(db, 60_000);
  assert.equal(calls, 3);
  assert.equal(db.rows[0].status, 'done');
  assert.equal(db.rows[0].processed, 30);
  assert.equal(db.rows[0].changed, 9);
  assert.equal(db.rows[0].failed, 1);
  assert.equal(db.rows[0].locked_until, null);
  assert.equal(out.finished.length, 1);
}

// 2. A job someone else holds (an unexpired lease) is left alone.
{
  let calls = 0;
  JOBS.awards.batch = async () => { calls++; return { cursor: '1', processed: 1, changed: 0, failed: 0, done: true }; };
  const db = fakeDb([job({ id: 'b', locked_until: new Date(Date.now() + 60_000).toISOString() })]);
  await runJobs(db, 60_000);
  assert.equal(calls, 0);
  assert.equal(db.rows[0].status, 'running');
}

// 3. Stop wins: once an admin stops the job, the runner's next update changes nothing and it ends.
{
  const db = fakeDb([job({ id: 'c' })]);
  let calls = 0;
  JOBS.awards.batch = async (_db, cursor) => { calls++; if (calls === 2) db.rows[0].status = 'stopped'; return { cursor: String(calls), processed: 5, changed: 1, failed: 0, done: false }; };
  await runJobs(db, 60_000);
  assert.equal(calls, 2);
  assert.equal(db.rows[0].status, 'stopped');
  assert.equal(db.rows[0].processed, 5, 'the batch after Stop is not counted');
}

// 4. Three batches in a row that throw: the job fails with the reason, and keeps its place.
{
  JOBS.awards.batch = async () => { throw new Error('TMDB returned 503'); };
  const db = fakeDb([job({ id: 'd', cursor: 'abc' })]);
  await runJobs(db, 60_000);
  assert.equal(db.rows[0].status, 'failed');
  assert.equal(db.rows[0].last_error, 'TMDB returned 503');
  assert.equal(db.rows[0].cursor, 'abc');
}

// 5. Two running jobs share the time: both make progress in one run.
{
  JOBS.awards.batch = async (_db, cursor) => { await new Promise((r) => setTimeout(r, 30)); return { cursor: String(Number(cursor ?? 0) + 1), processed: 1, changed: 0, failed: 0, done: false }; };
  JOBS.watch.batch = JOBS.awards.batch;
  const db = fakeDb([job({ id: 'e', kind: 'awards' }), job({ id: 'f', kind: 'watch', started_at: '2026-11-27T10:01:00Z' })]);
  await runJobs(db, 1_000);
  assert(db.rows[0].processed > 0 && db.rows[1].processed > 0, `both ran: ${db.rows[0].processed}, ${db.rows[1].processed}`);
  assert(db.rows.every((r) => r.status === 'running' && r.locked_until === null), 'unfinished jobs are released for the next run');
}

console.log('PASS: jobs run to the end, respect leases and Stop, fail after three errors in a row, and share the time.');
