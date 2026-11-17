import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = ts.transpileModule(fs.readFileSync('lib/home.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(source, { exports });
const { buildHomeData, homeWeek, popularHomeFilms } = exports;
const film = (id, overrides = {}) => ({ id, slug: id, title: id, status: 'published', featured: true, note: 'Why it matters', backdrop_url: null, ...overrides });
const director = (id, overrides = {}) => ({ id, slug: id, photo_url: null, bio: 'A biography', films: [film(id)], ...overrides });
const list = (id, films, overrides = {}) => ({ id, films, featured: false, staff_pick: false, ...overrides });
const films = [film('a'), film('b'), film('c'), film('draft', { status: 'draft' })];
const lists = [list('one', [films[0], films[0], films[1]]), list('two', [films[1], films[2], films[3]])];
const ids = (rows) => Array.from(rows, (row) => row.id);
assert.deepEqual(ids(popularHomeFilms(films, lists)), ['b', 'a', 'c'], 'distinct public watchlists determine popularity; draft films stay out');
assert.deepEqual(ids(popularHomeFilms(films, [...lists, lists[0]])), ['b', 'a', 'c'], 'duplicate watchlists cannot change the rank');
assert.deepEqual(ids(popularHomeFilms(films, [])), [], 'no invented popularity fallback');

const monday = new Date('2026-11-16T00:00:00Z');
const sunday = new Date('2026-11-22T23:59:59Z');
const nextMonday = new Date('2026-11-23T00:00:00Z');
assert.equal(homeWeek(monday), homeWeek(sunday));
assert.equal(homeWeek(nextMonday), homeWeek(monday) + 1, 'rotation advances at midnight Monday UTC');
const directors = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => director(id));
const a = buildHomeData(films, directors, lists, monday);
const b = buildHomeData([...films].reverse(), [...directors].reverse(), lists, sunday);
assert.equal(a.filmOfWeek.id, b.filmOfWeek.id, 'weekly film independent of input order');
assert.equal(a.directorOfWeek.id, b.directorOfWeek.id, 'weekly director stable all week');
assert.notEqual(a.filmOfWeek.id, buildHomeData(films, directors, lists, nextMonday).filmOfWeek.id, 'weekly film rotates');
assert.equal(a.directorsToFollow.length, 4);
assert.ok(a.directorsToFollow.every((d) => d.id !== a.directorOfWeek.id));
const excluded = a.directorsToFollow[0].id;
assert.ok(buildHomeData(films, directors, lists, monday, new Set([excluded])).directorsToFollow.every((d) => d.id !== excluded), 'already followed directors omitted when supplied');
assert.equal(buildHomeData([film('curated'), film('other', { featured: false, backdrop_url: 'still.jpg' })], [], [], monday).filmOfWeek.id, 'curated', 'editorial selection wins over an unrelated still');
assert.equal(buildHomeData([], [], [], monday).filmOfWeek, null);
assert.equal(buildHomeData([], [], [], monday).directorOfWeek, null);
assert.deepEqual(ids(buildHomeData(films, directors, [list('ordinary', films), list('pick', films, { staff_pick: true }), list('featured', films, { featured: true })], monday).featuredWatchlists), ['pick', 'featured'], 'community section only shows featured watchlists and staff picks');
console.log('PASS: weekly picks, public-watchlist popularity, featured community, follow suggestions, and empty catalog');
