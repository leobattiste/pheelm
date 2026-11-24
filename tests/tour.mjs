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

// The tour list: the menu tour is on every page and goes first; page tours belong to their own page.
const reg = ts.transpileModule(fs.readFileSync('lib/tours.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const rm = { exports: {} };
new Function('module', 'exports', reg)(rm, rm.exports);
const { ALL_TOURS, toursFor, tourCopy } = rm.exports;
assert.equal(new Set(ALL_TOURS.map(t => t.id)).size, ALL_TOURS.length, 'tour ids are unique');
assert.deepEqual(toursFor('/films').map(t => t.id), ['menu', 'films']);
assert.deepEqual(toursFor('/films/dahomey').map(t => t.id), ['menu', 'film']);
assert.deepEqual(toursFor('/directors').map(t => t.id), ['menu', 'directors']);
assert.deepEqual(toursFor('/watchlists').map(t => t.id), ['menu', 'watchlists']);
assert.deepEqual(toursFor('/directors/ava-duvernay').map(t => t.id), ['menu'], 'a director page has no tour yet');
assert.deepEqual(toursFor('/about').map(t => t.id), ['menu']);
for (const t of ALL_TOURS) for (const member of [true, false]) {
  const steps = t.steps(member);
  assert(steps.length >= 2, `${t.id} has steps`);
  for (const st of steps) { assert(st.targets.length && st.title && st.text, `${t.id}: ${st.title} is complete`); assert(st.text.length < 140, `${t.id}: ${st.title} stays short`); }
}
assert.equal(ALL_TOURS.find(t => t.id === 'menu').doneLabel, 'Start exploring');
assert(tourCopy(ALL_TOURS[0]).some(c => c.title === 'Your profile') && tourCopy(ALL_TOURS[0]).some(c => c.title === 'Join the community'));

// The tour is wired in once, and remembers in the browser and on the account.
const layout = fs.readFileSync('app/layout.tsx', 'utf8');
assert.equal((layout.match(/<Tour \/>/g) ?? []).length, 1);
const tour = fs.readFileSync('components/Tour.tsx', 'utf8');
assert.match(tour, /localStorage\.setItem\(TOUR_STORAGE_KEY/);
assert.match(tour, /from\("tour_progress"\)/);
assert.match(tour, /Don’t show again/);
// Getting started: five steps ticked off by real counts, shown in Settings, hidden once all are done; the first save explains itself.
const started = fs.readFileSync('app/account/GettingStarted.tsx', 'utf8');
assert.equal((started.match(/\{ key: "/g) ?? []).length, 5, 'five steps');
assert.match(started, /if \(done === STEPS\.length\) return null/);
const account = fs.readFileSync('app/account/page.tsx', 'utf8');
assert.match(account, /<GettingStarted counts=\{started\} \/>/);
for (const table of ['watched', 'watchlist', 'lists', 'follows', 'list_comments']) assert.match(account, new RegExp(`count\\("${table}"\\)`), `${table} is counted`);
assert.match(fs.readFileSync('components/WatchlistButton.tsx', 'utf8'), /pheelm:first-save/);
const migration = fs.readFileSync('supabase/migrations/20261123210000_tour_progress.sql', 'utf8');
assert.match(migration, /enable row level security/);
assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
assert.doesNotMatch(migration, /to anon/);
console.log('PASS: tour shows three times at most, stops when finished or switched off, merges browser and account, is wired in.');
