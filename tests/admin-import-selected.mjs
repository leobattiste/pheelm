import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const ids = Array.from({length: 4}, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`);
let allowed = true, enabled = true, calls = [], logs = [], failFilm = false, missingId = false, updateError = false;
const db = {from: () => ({select: () => ({eq: (_, id) => ({single: async () => ({data: {id, name: 'Director', tmdb_id: missingId ? null : 42}, error: null})})})})};
function load(path, require) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports, require, Error});
  return exports;
}
const action = load('app/admin/import-selected.ts', name => {
  if (name === '@/lib/admin') return {adminClient: async () => {if (!allowed) throw Error('Only admins'); return db;}};
  if (name === '@/lib/admin-activity') return {logAdminActivity: async (...args) => logs.push(args)};
  if (name === '@/lib/import') return {
    importFilm: async (_, id) => {calls.push(id); if (failFilm && id === ids[1]) throw Error('No confident match'); return 'Imported film';},
    fillPerson: async (_, person) => {calls.push(person.id); if (updateError) throw Error('Write denied');},
  };
  if (name === '@/lib/tmdb') return {get tmdbEnabled() {return enabled;}};
  if (name === 'next/cache') return {revalidatePath: () => {}};
  throw Error(name);
}).importSelectedFromTmdb;

allowed = false;
await assert.rejects(action('films', [ids[0]]), /Only admins/);
assert.equal(calls.length, 0);
allowed = true;
for (const [entity, selection] of [['other', [ids[0]]], ['films', []], ['films', ids], ['films', ['invalid']]]) await assert.rejects(action(entity, selection));
enabled = false;
await assert.rejects(action('films', [ids[0]]), /unavailable/);
assert.equal(calls.length, 0);
enabled = true; failFilm = true;
let results = await action('films', [ids[0], ids[1], ids[0]]);
assert.deepEqual(Array.from(results, r => r.ok), [true, false]);
assert.equal(calls.length, 2, 'duplicate IDs imported twice');
assert.equal(logs.length, 1, 'failed import logged as successful');
assert.match(results[1].message, /No confident match/);
missingId = true; calls = [];
assert.match((await action('people', [ids[0]]))[0].message, /TMDB person ID/);
assert.equal(calls.length, 0, 'director identity guessed without an ID');
missingId = false; updateError = true;
assert.equal((await action('people', [ids[0]]))[0].ok, false);
updateError = false;
assert.equal((await action('people', [ids[0]]))[0].ok, true);

// Exercise the actual fill helper: manual content stays intact and rejected writes never succeed silently.
let patch, writeError = null;
const fill = load('lib/import.ts', name => {
  if (name === 'server-only' || name === 'sharp' || name === './format') return {};
  if (name === './tmdb') return {getPersonDetails: async () => ({bio:'TMDB bio', photo_url:'TMDB photo', birth_year:1970})};
  throw Error(name);
}).fillPerson;
const fillDb = {from: () => ({update: value => {patch = value; return {eq: () => ({select: () => ({single: async () => ({error: writeError})})})};}})};
await fill(fillDb, {id: ids[0], name: 'Director', tmdb_id: 42, bio: 'Manual bio', photo_url: 'Manual photo'});
assert.equal(patch.birth_year, 1970);
assert.ok(!('bio' in patch) && !('photo_url' in patch), 'manual fields overwritten');
writeError = {message: 'Write rejected'};
await assert.rejects(fill(fillDb, {id: ids[0], name: 'Director', tmdb_id: 42}), /Write rejected/);
console.log('PASS: bulk import authorization, batch bounds, deduplication, per-item failures, director matching, preserved edits and database errors.');
