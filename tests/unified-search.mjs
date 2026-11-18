import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const modules = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (modules.has(absolute)) return modules.get(absolute);
  const exports = {};
  modules.set(absolute, exports);
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, URLSearchParams, require: name => load(path.resolve(path.dirname(absolute), name) + '.ts') });
  return exports;
}
const model = load('lib/unified-search.ts');
const { cleanUnifiedState, unifiedQuery, indexUnified, searchUnified, unifiedResults, unifiedFacets, activeUnifiedFilters, unifiedFilterLabel } = model;
const entry = (id, title, overrides = {}) => ({
  id, slug: id, title, image: null, subtitle: '', aliases: [], names: ['Ousmane Sembène'], countries: ['SN'], languages: ['French'], genres: ['Drama'],
  types: ['feature'], years: [1992], runtime: 110, wins: 1, nominations: 2, awards: ['Cannes Film Festival'],
  availability: [{ provider: 'Netflix', region: 'US', kind: 'stream' }, { provider: 'Mubi', region: 'GB', kind: 'rent' }],
  added: Date.parse('2026-01-01'), count: 1, filmography: [{ year: 1992, type: 'feature' }], ...overrides,
});
const films = [
  entry('hyenas', 'Hyènes', { aliases: ['Hyenas'] }),
  entry('black-girl', 'La Noire de…', { aliases: ['Black Girl'], years: [1966], runtime: 65, wins: 0, nominations: 0, availability: [{ provider: 'Mubi', region: 'GB', kind: 'free' }] }),
  entry('atlantics', 'Atlantics', { names: ['Mati Diop'], years: [2019], genres: ['Drama', 'Romance'], wins: 2 }),
  entry('unknown', 'Unknown running time', { types: ['documentary'], runtime: null, languages: ['English'], genres: ['Documentary'], wins: 0, availability: [] }),
  entry('us', 'Us', { countries: ['US'], names: ['Jordan Peele'], genres: ['Horror'], years: [2019], runtime: 116, wins: 0, nominations: 0, availability: [] }),
];
const directors = [
  entry('sembene', 'Ousmane Sembène', { aliases: ['Hyènes', 'Hyenas', 'Black Girl'], names: [], years: [1966, 1992], count: 2, filmography: [{year: 1966, type: 'feature', genres: ['Drama']}, {year: 1992, type: 'feature', genres: ['Drama']}] }),
  entry('jenkins', 'Barry Jenkins', { aliases: ['Moonlight'], names: [], countries: ['US'], years: [2008, 2016], genres: ['Drama', 'Romance'], count: 3, filmography: [{year: 2008, type: 'feature', genres: ['Romance']}, {year: 2016, type: 'feature', genres: ['Drama']}] }),
];
const owner = { id: 'viewer', handle: 'leo', display_name: 'Leo Battiste' };
const watchlist = (id, title, filmIds, overrides = {}) => ({
  id, slug: id, title, description: 'A curated watchlist', is_public: true, featured: false, staff_pick: false, owner, filmIds,
  tile: { id, slug: id, title, owner, films: [] }, updated_at: '2026-11-17T00:00:00Z', created_at: '2026-01-01T00:00:00Z', saves: 0, ...overrides,
});
const data = {
  films, directors,
  watchlists: [watchlist('new', 'New discoveries', ['hyenas', 'black-girl']), watchlist('old', 'Old favorites', ['us'], { updated_at: '2026-01-01T00:00:00Z' })],
  members: [
    { id: 'ada', handle: 'ada_cinema', display_name: 'Ada Cinema', avatar_url: null, country: 'NG', bio: null, following: true, followsYou: false },
    { id: 'no-name', handle: 'quiet_viewer', display_name: null, avatar_url: null, country: null, bio: null, following: false, followsYou: true },
  ], signedIn: true, viewerId: 'viewer',
};
const ids = rows => Array.from(rows, row => row.id);
const find = (category, values = {}) => searchUnified(indexUnified(data, category), { category, q: '', ...values }, Date.parse('2026-11-18T00:00:00Z'));

assert.deepEqual(ids(find('films', { q: 'Hyenas' })), ['hyenas'], 'alternate titles match despite accents');
assert.equal(find('films', { q: 'Us' })[0].id, 'us', 'short literal film title remains searchable');
assert.ok(find('films', { q: 'Sembane' }).some(f => f.id === 'hyenas'), 'director typo finds their films');
assert.equal(find('directors', { q: 'Moonlight' })[0].id, 'jenkins', 'filmography title finds a director');
assert.equal(find('members', { q: '@ada_cinema' })[0].id, 'ada', 'member handle with @ matches');
assert.equal(find('members', { q: 'quiet_viewer' })[0].title, 'quiet_viewer', 'members without display names remain discoverable');
assert.equal(find('watchlists', { q: 'Leo Battiste' }).length, 2, 'creator name finds watchlists');
assert.deepEqual(ids(find('films', { country: 'SN', genre: 'Drama', from: '1990', to: '1999', minRuntime: '90', maxRuntime: '120' })), ['hyenas'], 'film filters combine');
assert.ok(!ids(find('films', { maxRuntime: '120' })).includes('unknown'), 'unknown runtime cannot satisfy a runtime cap');
assert.deepEqual(ids(find('films', { type: 'documentary' })), ['unknown']);
assert.equal(find('films', { provider: 'Netflix', region: 'GB' }).length, 0, 'provider and region must match the same viewing option');
assert.equal(find('films', { provider: 'Mubi', region: 'GB', availability: 'stream' }).length, 0, 'availability kind must match the same option too');
assert.deepEqual(ids(find('films', { availability: 'free' })), ['black-girl']);
assert.deepEqual(ids(find('films', { award: 'won', sort: 'awards' })), ['atlantics', 'hyenas']);
assert.equal(find('films', { from: '2020', to: '1900' }).length, 0, 'inverted ranges do not broaden results');
assert.deepEqual(ids(find('directors', { country: 'SN', genre: 'Drama', from: '1990' })), ['sembene']);
assert.deepEqual(ids(find('directors', { sort: 'count' })), ['jenkins', 'sembene']);
assert.equal(find('directors', { country: 'US', genre: 'Romance', from: '2010' }).length, 0, 'director genre and date range must match the same film');
assert.deepEqual(ids(find('watchlists', { genre: 'Drama', min: '2', max: '2', updated: '7' })), ['new'], 'watchlists support genre, size and recent-update filters');
assert.deepEqual(ids(find('watchlists', { max: '1' })), ['old']);
assert.deepEqual(ids(find('members', { following: '1' })), ['ada']);
assert.deepEqual(ids(find('members', { followsYou: '1' })), ['no-name']);
assert.equal(find('members', { following: '1', followsYou: '1' }).length, 0);
assert.equal(find('films', { q: 'zzzzzzzzzzzzzzzzzz' }).length, 0);

const clean = cleanUnifiedState(new URLSearchParams('category=members&q=Ada&genre=Drama&country=US&minRuntime=10&following=1&followsYou=yes&sort=newest&unknown=secret'));
assert.deepEqual(JSON.parse(JSON.stringify(clean)), { category: 'members', q: 'Ada', following: '1' }, 'category controls allowed filters and sorts');
assert.equal(cleanUnifiedState(new URLSearchParams('category=invalid')).category, 'films');
assert.equal(cleanUnifiedState(new URLSearchParams('q=' + 'x'.repeat(500))).q.length, 200);
const invalid = cleanUnifiedState(new URLSearchParams('from=bad&to=9999&minRuntime=-1&maxRuntime=1.5&award=no&availability=unknown'));
assert.deepEqual(JSON.parse(JSON.stringify(invalid)), { category: 'films', q: '' }, 'malformed numeric and enum filters are discarded');
for (const category of model.CATEGORIES) {
  const state = cleanUnifiedState(new URLSearchParams(`category=${category}&q=Moonlight%20%26%20friends&sort=title`));
  assert.equal(JSON.stringify(cleanUnifiedState(new URLSearchParams(unifiedQuery(state)))), JSON.stringify(state), `${category} state round-trips through its URL`);
}
assert.deepEqual(Array.from(activeUnifiedFilters({ category: 'films', q: '', country: 'SN', maxRuntime: '90' })), ['country', 'maxRuntime']);
assert.equal(unifiedFilterLabel('country', 'SN'), 'Senegal');
assert.equal(unifiedFilterLabel('following', '1'), 'Members you follow');
assert.ok(Array.from(unifiedFacets(indexUnified(data, 'watchlists')).genre).includes('Horror'), 'watchlist facets derive from included film genres');
assert.equal(unifiedResults(data, 'watchlists')[0].href, '/watchlists/new');
assert.equal(unifiedResults(data, 'members')[0].href, '/@ada_cinema');
console.log('PASS: unified category search, aliases/typos, contextual filters, availability coherence, sorting, handles, empty states and URL validation');
