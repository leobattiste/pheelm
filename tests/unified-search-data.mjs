import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const movie = (id, status = 'published') => ({ id, slug: id, title: id, status, year: 2020, type: 'feature', poster_url: null, original_title: null, countries: ['SN'], languages: ['French'], genres: [status === 'draft' ? 'SecretGenre' : 'Drama'], runtime: 90, awards: [], watch: [], directors: [{ id: 'director', name: 'Director' }], credits: [{ person: { name: 'Director' } }] });
const films = [movie('published'), movie('draft', 'draft')];
const publicMember = (id, fields = {}) => ({ id, handle: id, display_name: id, avatar_url: null, country: 'SN', bio: 'A film lover', is_private: false, email: 'never-expose@example.test', is_admin: true, ...fields });
const list = (id, fields = {}) => ({ id, slug: id, title: id, description: `Description ${id}`, user_id: 'other', is_public: true, hidden: false, featured: false, staff_pick: false, created_at: '2026-01-01', updated_at: null, list_films: [{ film_id: 'published', added_at: '2026-01-02' }, { film_id: 'draft', added_at: '2026-01-03' }], ...fields });
const tables = {
  lists: [list('public'), list('own-private', { user_id: 'viewer', is_public: false }), list('other-private', { is_public: false }), list('collaborator-private', { is_public: false }), list('hidden-public', { hidden: true }), list('hidden-own', { user_id: 'viewer', hidden: true, is_public: false })],
  member_profiles: [publicMember('viewer'), publicMember('followed'), publicMember('follower'), publicMember('private-person', { is_private: true }), publicMember('malformed', { handle: '' })],
  profiles: [{ id: 'viewer', handle: 'viewer', display_name: 'Private Viewer', email: 'own-email-must-stay-private@example.test', is_admin: true }, { id: 'other', handle: 'other', display_name: 'Other private name' }],
  member_follows: [{ follower_id: 'viewer', followed_id: 'followed' }, { follower_id: 'follower', followed_id: 'viewer' }, { follower_id: 'other', followed_id: 'private-person' }],
  list_save_counts: [{ list_id: 'public', saves: 7 }, { list_id: 'own-private', saves: 1 }, { list_id: 'other-private', saves: 999 }],
};
const state = { viewer: 'viewer', enabled: true, missingFollows: false };
const queries = [];
const db = {
  auth: { getUser: async () => ({ data: { user: state.viewer ? { id: state.viewer } : null } }) },
  from(table) {
    const query = { table, columns: '', filters: [], start: 0, end: Infinity };
    queries.push(query);
    const api = {
      select(columns) { query.columns = columns; return api; },
      eq(key, value) { query.filters.push({ key, value }); return api; },
      in(key, values) { query.filters.push({ key, values }); return api; },
      order() { return api; },
      range(start, end) { query.start = start; query.end = end; return api; },
      then(resolve) {
        if (table === 'member_follows' && state.missingFollows) return Promise.resolve({ data: null, error: { message: 'relation unavailable' } }).then(resolve);
        let rows = tables[table] ?? [];
        // Simulate broad admin/collaborator RLS results to ensure explicit DTO gates protect
        // against unexpected extra list/profile rows, not just the happy query response.
        if (!['lists', 'member_profiles'].includes(table)) {
          rows = rows.filter(row => query.filters.every(filter => filter.values ? filter.values.includes(row[filter.key]) : row[filter.key] === filter.value));
        }
        return Promise.resolve({ data: rows.slice(query.start, query.end + 1), error: null }).then(resolve);
      },
    };
    return api;
  },
};

const searchEntries = {};
vm.runInNewContext(compile('lib/search-data.ts'), { exports: searchEntries, require(name) {
  if (name === 'server-only') return {};
  if (name === './data') return { toCard: film => ({ id: film.id }), toDirectorSummary: director => ({ id: director.id }) };
  if (name === './watch') return { watchLink: () => null, serviceName: name => name };
  if (name === './format') return { countryName: country => country };
  throw Error(`Unexpected dependency ${name}`);
} });
const unified = {};
vm.runInNewContext(compile('lib/unified-search.ts'), { exports: unified, require(name) {
  if (name === './catalog-search') return {};
  if (name === './format') return { countryName: country => country };
  throw Error(`Unexpected dependency ${name}`);
} });
const loader = {};
vm.runInNewContext(compile('lib/unified-search-data.ts'), { exports: loader, require(name) {
  if (name === 'server-only') return {};
  if (name === 'next/cache') return {unstable_cache:fn=>fn};
  if (name === './search-discovery') return {avoidPrevious:ids=>ids,weeklyPopular:()=>[],mondayWeek:()=>1,RECOGNIZED_FILMS:[]};
  if (name === './film-popularity') return {getPopularMovieIds:async()=>[],rankPopularFilms:()=>[]};
  if (name === './supabase/server') return { getServerClient: async () => state.enabled ? db : null };
  if (name === '@supabase/supabase-js') return { createClient: () => db };
  if (name === './supabase/config') return { SUPABASE_URL: 'https://x', SUPABASE_ANON_KEY: 'k', get supabaseEnabled() { return state.enabled; } };
  if (name === './data') return { getFilms: async () => films, getDirectors: async () => [{ id: 'director', slug: 'director', name: 'Director', bio: 'Biography', country: 'SN', photo_url: null, films }, { id: 'excluded', in_directory: false, films }] };
  if (name === './search-data') return searchEntries;
  if (name === './unified-search') return unified;
  throw Error(`Unexpected dependency ${name}`);
} });

const data = await loader.getUnifiedSearchData();
const ids = rows => Array.from(rows, row => row.id);
assert.deepEqual(ids(data.watchlists).sort(), ['public'], 'only public nonhidden lists appear');
assert.deepEqual(ids(data.films), ['published']);
assert.deepEqual(ids(data.directors), ['director']);
assert.deepEqual(Array.from(data.directors[0].genres), ['Drama'], 'director genre metadata excludes draft films');
assert.deepEqual(Array.from(data.directors[0].filmography, film => film.genres[0]), ['Drama']);
assert.equal(data.directors[0].aliases.includes('draft'), false, 'draft titles do not reach director aliases');
assert.ok(data.watchlists.every(list => Array.from(list.filmIds).join() === 'published'), 'watchlist IDs only contain published films');
assert.ok(data.watchlists.every(list => Array.from(list.tile.films, film => film.id).join() === 'published'), 'draft posters do not leak through watchlist previews');
assert.equal(data.watchlists.find(list => list.id === 'public').saves, 0, 'unused compatibility field does not trigger count-query fanout');
assert.equal(data.viewerId, 'viewer');
assert.equal(data.signedIn, true);
assert.deepEqual(ids(data.members), ['viewer', 'followed', 'follower']);
assert.equal(data.members.find(member => member.id === 'followed').following, true);
assert.equal(data.members.find(member => member.id === 'follower').followsYou, true);
assert.ok(!JSON.stringify(data).includes('never-expose') && !JSON.stringify(data).includes('is_admin'), 'member DTO never serializes email or privilege fields');
assert.ok(queries.filter(query => query.table === 'lists').every(query => query.filters.some(filter => filter.key === 'hidden' && filter.value === false)));
assert.ok(queries.filter(query => query.table === 'member_profiles').every(query => query.filters.some(filter => filter.key === 'is_private' && filter.value === false)));
assert.ok(queries.every(query => !query.columns.includes('*')), 'queries select compact columns');
assert.ok(queries.filter(query => query.table === 'profiles').every(query => query.columns === 'id,handle,display_name' && query.filters.some(filter => filter.key === 'id' && filter.value === 'viewer')), 'own-profile label query is minimal and explicitly owned');
assert.ok(queries.every(query => query.table !== 'list_save_counts'), 'search needs no per-watchlist count queries');

const viewerMember = tables.member_profiles.find(member => member.id === 'viewer');
viewerMember.is_private = true;
const privateViewer = await loader.getUnifiedSearchData();
assert.equal(privateViewer.members.some(member => member.id === 'viewer'), false, 'own private profile remains outside member search results');
assert.equal(privateViewer.watchlists.some(list=>list.id==='own-private'),false);
viewerMember.is_private = false;

state.viewer = 'other';
const nextViewer = await loader.getUnifiedSearchData();
assert.ok(!ids(nextViewer.watchlists).includes('own-private'), 'viewer-specific results are not reused across accounts');
state.viewer = null;
const visitor = await loader.getUnifiedSearchData();
assert.deepEqual(ids(visitor.watchlists), ['public'], 'anonymous search never returns private lists even with unexpectedly broad query rows');
assert.ok(visitor.members.every(member => !member.following && !member.followsYou));
assert.equal(visitor.viewerId, null);
state.viewer = 'viewer';
state.missingFollows = true;
const legacy = await loader.getUnifiedSearchData();
assert.ok(legacy.members.every(member => !member.following && !member.followsYou), 'missing additive follow table degrades without exposing anything');
const previousProfiles = tables.member_profiles;
tables.member_profiles = Array.from({ length: 1001 }, (_, index) => publicMember(`member${String(index).padStart(4, '0')}`));
const paginated = await loader.getUnifiedSearchData();
assert.equal(paginated.members.length, 1001, 'member index paginates past Supabase’s default 1000-row response limit');
tables.member_profiles = previousProfiles;
state.enabled = false;
const starter = await loader.getUnifiedSearchData();
assert.deepEqual(ids(starter.films), ['published']);
assert.deepEqual(ids(starter.watchlists), []);
assert.deepEqual(ids(starter.members), []);

const endpoint = {};
vm.runInNewContext(compile('app/api/search/route.ts'), { exports: endpoint, Response, require() { return { getUnifiedSearchData: loader.getUnifiedSearchData, getViewerSearchData: loader.getViewerSearchData }; } });
const req = (q = '') => ({ nextUrl: new URL('https://x/api/search' + q) });
const response = await endpoint.GET(req());
const viewerResponse = await endpoint.GET(req('?viewer=1'));
assert.equal(viewerResponse.headers.get('cache-control'), 'private, no-store');
const viewerBody = await viewerResponse.json();
assert.equal('films' in viewerBody, false, 'the viewer endpoint returns only the viewer\'s own part');
assert.equal(response.headers.get('cache-control'), 'private, no-store');
assert.equal(response.headers.get('vary'), 'Cookie');
assert.equal(response.status, 200);
const failingEndpoint = {};
vm.runInNewContext(compile('app/api/search/route.ts'), { exports: failingEndpoint, Response, require() { return { getUnifiedSearchData: async () => { throw Error('private request details'); } }; } });
const failedResponse = await failingEndpoint.GET(req());
assert.equal(failedResponse.status, 503);
assert.equal(failedResponse.headers.get('cache-control'), 'private, no-store');
assert.equal((await failedResponse.text()).includes('private request details'), false, 'error payloads never expose internal data or credential-bearing request details');
console.log('PASS: request-scoped search, public-only lists, private profile and draft exclusion, follow direction, legacy fallback, compact DTOs, and private no-store endpoint');