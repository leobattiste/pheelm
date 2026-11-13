// Members' Home (app/home/page.tsx) rendered with fixture data from data/catalog.json: a member
// with follows, a Watchlist and watched films, and a brand-new member. Checks sections appear or
// stay hidden as they should and nothing overflows from 320px up. No Supabase needed.
// Run: node tests/home-browser.mjs (CHROMIUM_PATH can override the browser; HOME_SCREENSHOTS=dir saves shots).
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { chromium } from 'playwright-core';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const catalog = JSON.parse(readFileSync(resolve(root, 'data/catalog.json'), 'utf8'));
const people = new Map(catalog.people.map((p) => [p.id, p]));
const now = Date.now();
const films = catalog.films.map((f, i) => ({
  ...f, awards: f.awards ?? [], watch: f.watch ?? [], aka: f.aka ?? [], created_at: new Date(now - i * 9 * 86400000).toISOString(),
  directors: catalog.credits.filter((c) => c.film_id === f.id && c.role === 'director').map((c) => people.get(c.person_id)).filter(Boolean),
  credits: [], collections: [],
}));
const toCard = (f) => ({ id: f.id, slug: f.slug, title: f.title, year: f.year, type: f.type, countries: f.countries, languages: f.languages, genres: f.genres, poster_url: f.poster_url, color: f.color ?? null, runtime: f.runtime ?? null, directors: f.directors.map((d) => d.name), wins: 0 });
const byTitle = (t) => films.find((f) => f.title === t) ?? films[0];
const followedDirector = films[2].directors[0];

const member = {
  profiles: [{ display_name: 'Leo Battiste', handle: 'leo' }],
  watchlist: films.slice(10, 22).map((f, i) => ({ film_id: f.id, added_at: new Date(now - i * 86400000).toISOString() })),
  follows: [{ person_id: followedDirector.id }, ...films.slice(5, 9).flatMap((f) => f.directors.map((d) => ({ person_id: d.id })))],
  watched: films.slice(30, 36).map((f, i) => ({ film_id: f.id, watched_at: new Date(now - i * 86400000).toISOString() })),
  list_saves: [],
  list_comments: [
    { id: 'c1', body: 'The final scene still sits with me. Every frame of that ending feels painted.', spoiler: false, created_at: '2026-11-11', user_id: 'm1', list_id: null, film_id: films[3].id, lists: null, films: { title: films[3].title, slug: films[3].slug } },
    { id: 'c2', body: 'hidden', spoiler: true, created_at: '2026-11-10', user_id: 'm2', list_id: null, film_id: films[4].id, lists: null, films: { title: films[4].title, slug: films[4].slug } },
    { id: 'c3', body: 'Great list, adding a few of these to my weekend.', spoiler: false, created_at: '2026-11-09', user_id: 'm1', list_id: 'l1', film_id: null, lists: { title: 'The Birth of African Cinema' }, films: null },
  ],
  member_profiles: [{ id: 'm1', handle: 'ama', display_name: 'Ama Owusu', avatar_url: null }, { id: 'm2', handle: 'kofi', display_name: null, avatar_url: null }],
  unread: 3,
};
const fresh = { profiles: [{ display_name: null, handle: 'newbie' }], watchlist: [], follows: [], watched: [], list_saves: [], list_comments: [], member_profiles: [], unread: 0 };
let records = member;

const tiles = [1, 2, 3, 4].map((n) => ({ id: `l${n}`, slug: `list-${n}`, title: ['The Birth of African Cinema', 'Nollywood classics', 'LA Rebellion', 'Black British cinema'][n - 1], description: null, created_at: '2026-11-01', updated_at: '2026-11-01', films: films.slice(n * 3, n * 3 + 3).map((f) => ({ ...f, directors: f.directors.map((d) => ({ name: d.name })) })), owner: { id: `o${n}`, handle: `curator${n}`, display_name: null }, saves: n, curators: 1 }));
const db = {
  auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
  from: (table) => {
    let one = false;
    const query = new Proxy({}, { get: (_, key) => key === 'then'
      ? (fn) => Promise.resolve(table === 'notifications' ? { count: records.unread, data: null, error: null } : { data: one ? (records[table] ?? [])[0] ?? null : records[table] ?? [], error: null }).then(fn)
      : (key === 'single' || key === 'maybeSingle') ? () => { one = true; return query; } : () => query });
    return query;
  },
};

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  cache.set(file, module.exports);
  const localRequire = (id) => {
    if (id === 'next/link') return { __esModule: true, default: ({ children, prefetch, ...props }) => React.createElement('a', props, children) };
    if (id === 'next/navigation') return { usePathname: () => '/home', useRouter: () => ({ push() {}, replace() {}, refresh() {} }), redirect: (to) => { throw Error('Unexpected redirect to ' + to); } };
    if (id === '@/lib/supabase/server') return { getServerClient: async () => db };
    if (id === '@/lib/data') return { getFilms: async () => films, toCard };
    if (id === '@/lib/community') return { getCommunityCollections: async () => tiles };
    if (id === '@/lib/seo') return { privateMetadata: () => ({}) };
    if (id === './Transitions' || id === '@/components/Transitions') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === './QuickSave') return { __esModule: true, default: () => null };
    if (id.endsWith('.css') || id === 'server-only') return {};
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? resolve(root, id.slice(2)) : resolve(dirname(file), id);
      const target = ['.tsx', '.ts', ''].map((ext) => base + ext).find(existsSync);
      if (target) return load(target);
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  Object.assign(cache.get(file), module.exports);
  return module.exports;
}
const Home = load(resolve(root, 'app/home/page.tsx')).default;

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const font = readFileSync(resolve(root, 'app/fonts/Inter-Latin.woff2')).toString('base64');
const css = readFileSync(resolve(root, 'app/globals.css'), 'utf8') + `\n@font-face { font-family: FixtureInter; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; } :root { --font-inter: FixtureInter; }`;
const shots = process.env.HOME_SCREENSHOTS;
if (shots) mkdirSync(shots, { recursive: true });
try {
  for (const [who, data] of [['member', member], ['new', fresh]]) {
    records = data;
    const html = renderToStaticMarkup(await Home());
    for (const theme of ['dark', 'light']) {
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(`<!doctype html><html data-theme="${theme}" data-auth="in" data-chrome="app"><head><style>${css}</style></head><body><main>${html}</main></body></html>`);
        await page.evaluate(() => document.fonts.ready);
        const prefix = `${who}/${theme}/${width}`;
        const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.row-track')).slice(0, 3).map((el) => el.className + ' ' + Math.round(el.getBoundingClientRect().right)));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${prefix}: page overflows ${wide.join(', ')}`);
        const headings = await page.locator('h2').allTextContents();
        if (who === 'member') {
          for (const h of ['New from directors you follow', 'Your Watchlist', 'Watchlists to follow', 'What people are saying', 'Keep discovering']) assert(headings.includes(h), `${prefix}: missing ${h}`);
          assert(headings.some((h) => h.startsWith('Because you watched')), `${prefix}: missing Because you watched`);
          assert.match(await page.locator('.home-next-label').textContent(), /^New from /, `${prefix}: next step`);
          assert.equal(await page.locator('.home-unread').textContent(), '3 new notifications');
          assert.equal(await page.getByText('hidden').count(), 0, `${prefix}: spoiler shown`);
          assert.equal(await page.getByText('Contains spoilers. Open to read.').count(), 1);
        } else {
          assert.deepEqual(headings, ['Make Pheelm yours', 'Watchlists to follow', 'Keep discovering'], `${prefix}: a new member only sees how to start and what to discover`);
        }
        if (shots && theme === 'dark' && (width === 390 || width === 1280)) await page.screenshot({ path: `${shots}/${who}-${width}.png`, fullPage: true });
      }
    }
  }
  console.log('PASS: Home sections for an active and a new member, hidden spoilers, no overflow from 320px to 1280px in both themes.');
} finally {
  await browser.close();
}
