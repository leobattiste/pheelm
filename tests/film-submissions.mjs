import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let rows = [];
let failed = false;
let signedIn = true;
const db = {
  auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'qa-member' } : null } }) },
  from: (table) => ({ insert: async (row) => { rows.push({ table, row }); return { error: failed ? { code: 'PGRST204' } : null }; } }),
};
const source = ts.transpileModule(fs.readFileSync('app/submit/actions.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
vm.runInNewContext(source, { exports, FormData, require: (name) => {
  assert.equal(name, '@/lib/supabase/server');
  return { getServerClient: async () => db };
} });
const form = (extra = {}) => {
  const f = new FormData();
  for (const [key, value] of Object.entries({ title: 'QA Film', director: 'QA Director', year: '2026', email: 'pheelm-qa@example.invalid', rights: 'on', ...extra })) f.set(key, value);
  return f;
};
const state = { ok: false, message: '' };
const details = { type: 'documentary', aka: 'Another title; Working title', note: 'Why this film matters', original_title: 'Original title', runtime: '93', countries: 'SN, FR', languages: 'Wolof, French', genres: 'Documentary', synopsis: 's'.repeat(3000), poster: 'https://example.invalid/poster.webp', backdrop: 'https://example.invalid/still.webp', trailer: 'https://youtu.be/example', website: 'https://example.invalid/film', credits: 'c'.repeat(3000), awards: 'QA Festival | Documentary | nominated | 2026', watch: 'QA Service | https://example.invalid/watch | rent | GB', name: 'QA Owner', role: 'Producer' };
assert.equal((await exports.submitOwnFilm(state, form(details))).ok, true);
assert.equal(rows.length, 1);
const saved = rows[0].row;
assert.equal(saved.kind, 'own');
assert.equal(saved.user_id, 'qa-member');
for (const key of ['type', 'aka', 'note', 'backdrop', 'synopsis', 'credits', 'awards', 'watch']) assert.equal(saved.details[key], details[key]);
assert.equal(saved.details.runtime, 93);
assert.equal(saved.details.submitted_by, details.name);
rows = [];
for (const invalid of [{ runtime: '-1' }, { runtime: '1.5' }, { runtime: '0' }, { type: 'invalid' }, { backdrop: 'javascript:alert(1)' }, { rights: '' }, { year: 'bad' }, { email: 'bad' }]) {
  assert.equal((await exports.submitOwnFilm(state, form(invalid))).ok, false);
  assert.equal(rows.length, 0);
}
failed = true;
assert.equal((await exports.submitOwnFilm(state, form(details))).ok, false);
assert.equal(rows.length, 1, 'A schema failure must not silently retry through a truncated note');
failed = false;
rows = [];
signedIn = false;
assert.equal((await exports.submitOwnFilm(state, form(details))).ok, false);
assert.equal(rows.length, 0);
signedIn = true;
assert.equal((await exports.submitFilm(state, form({ link: 'https://example.invalid/film' }))).ok, true);
assert.equal(rows[0].row.details, undefined, 'Fan suggestions keep the simple form');
console.log('PASS: owner detail preservation, invalid inputs, database failures, authentication and simple fan suggestions');
