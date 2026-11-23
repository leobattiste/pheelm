import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// lib/tour.ts has no imports, so it can be run as it is.
const code = ts.transpileModule(fs.readFileSync('lib/tour.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', code)(mod, mod.exports);
const { TOUR_LIMIT, emptyTourState, cleanTourState, mergeTourState, canShowTour, startTour, finishTour, turnOffTours } = mod.exports;

// Shows, then twice more after being closed or refreshed, then never again.
assert.equal(TOUR_LIMIT, 3);
let s = emptyTourState();
for (let i = 0; i < 3; i++) { assert.equal(canShowTour(s, 'menu'), true, `showing ${i + 1} is allowed`); s = startTour(s, 'menu'); }
assert.equal(canShowTour(s, 'menu'), false, 'a fourth showing is not');
assert.equal(s.tours.menu.shown, 3);

// Finishing or "Don't show again" stops it straight away.
assert.equal(canShowTour(finishTour(startTour(emptyTourState(), 'menu'), 'menu'), 'menu'), false);
assert.equal(canShowTour(turnOffTours(emptyTourState()), 'menu'), false);
assert.equal(canShowTour(turnOffTours(emptyTourState()), 'films'), false, 'off covers every tour');
assert.equal(canShowTour(finishTour(emptyTourState(), 'menu'), 'films'), true, 'finishing one tour leaves the others');

// Signing in: this browser and the account are combined and nothing seen is forgotten.
const merged = mergeTourState({ off: false, tours: { menu: { shown: 2, done: false } } }, { off: false, tours: { menu: { shown: 1, done: true }, films: { shown: 1, done: false } } });
assert.deepEqual(JSON.parse(JSON.stringify(merged)), { off: false, tours: { menu: { shown: 2, done: true }, films: { shown: 1, done: false } } });
assert.equal(mergeTourState({ off: true, tours: {} }, emptyTourState()).off, true);

// Whatever comes out of storage is cleaned.
assert.deepEqual(JSON.parse(JSON.stringify(cleanTourState('junk'))), { off: false, tours: {} });
assert.deepEqual(JSON.parse(JSON.stringify(cleanTourState({ off: 'yes', tours: { menu: { shown: 99, done: 1 }, 'Bad Id': { shown: 1 }, x: 5 } }))), { off: false, tours: { menu: { shown: 3, done: false } } });

// The tour is wired in once, and remembers in the browser and on the account.
const layout = fs.readFileSync('app/layout.tsx', 'utf8');
assert.equal((layout.match(/<Tour \/>/g) ?? []).length, 1);
const tour = fs.readFileSync('components/Tour.tsx', 'utf8');
assert.match(tour, /localStorage\.setItem\(TOUR_STORAGE_KEY/);
assert.match(tour, /from\("tour_progress"\)/);
assert.match(tour, /Don’t show again/);
const migration = fs.readFileSync('supabase/migrations/20261123210000_tour_progress.sql', 'utf8');
assert.match(migration, /enable row level security/);
assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
assert.doesNotMatch(migration, /to anon/);
console.log('PASS: tour shows three times at most, stops when finished or switched off, merges browser and account, is wired in.');
