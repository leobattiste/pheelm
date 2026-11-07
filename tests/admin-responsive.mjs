// Layout regression checks against real admin components, with fixture data only.
// No Supabase credentials or production auth bypass are needed.
// Run: node tests/admin-responsive.mjs (CHROMIUM_PATH can override the browser).
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
let pathname = '/admin';
let isOwner = true;
const noop = async () => ({ ok: true, message: '' });
const film = { id: 'fixture', slug: 'fixture', title: 'A very long film title that should remain readable on the smallest screen', year: 2026, type: 'documentary', status: 'draft', poster_url: null, featured: true, tmdb_id: 123, credits: [{ role: 'director', people: { name: 'A filmmaker with a particularly long name' } }] };
const films = [film, { ...film, id: 'fixture-2', title: 'Atlantics', year: 2019, status: 'published', featured: false }, { ...film, id: 'fixture-3', title: 'Moonlight', year: 2016, status: 'published' }];
const people = [{ id: 'director', slug: 'director', name: 'A filmmaker with a particularly long name', country: 'SN', photo_url: null, bio: null, directed: 3, credits: 5 }];
const members = [{ id: 'member', handle: 'curator', display_name: 'A member with a particularly long display name', email: 'curator@example.com', created_at: '2026-11-07', last_seen: '2026-11-07', is_admin: true, is_owner: false, is_private: false, lists: 12, saved: 14, comments: 18 }];
const collections = [{ id: 'collection', title: 'A collection of independent cinema', user_id: 'member', hidden: false, staff_pick: true, featured: false, created_at: '2026-11-07', list_films: [{ count: 12 }] }];
const collectionTiles = collections.map(c => ({ ...c, description: null, updated_at: c.created_at, films: films.map(f => ({ ...f, directors: [{ name: 'A filmmaker' }] })), owner: { id: 'member', handle: 'curator', display_name: 'Curator' }, saves: 7, curators: 1 }));
const records = {
  films, admin_people_quality: people, lists: collections,
  admin_activity: [{ id: 'change', action: 'Updated film', target_type: 'film', created_at: '2026-11-07' }],
  member_profiles: [{ id: 'member', handle: 'curator' }], list_save_counts: [{ list_id: 'collection', saves: 7 }],
  list_reports: [], comment_reports: [],
};
const db = { rpc: async () => ({ data: members, error: null }), from: (table) => {
  const query = new Proxy({}, { get: (_, key) => key === 'then'
    ? (fn) => Promise.resolve({ count: 128, data: records[table] ?? [] }).then(fn)
    : () => query });
  return query;
} };
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === 'next/navigation') return { usePathname: () => pathname };
    if (id === '@/lib/admin') return { requireAdmin: async () => ({ db, owner: isOwner, user: { id: "fixture-admin", email: "admin@example.com" } }) };
    if (id === '@/lib/tmdb') return { tmdbEnabled: false };
    if (id === '@/lib/data') return { getDirectors: async () => people, toDirectorSummary: p => ({ ...p, films: 3, first: 2016, last: 2026, previews: films.map(f => ({ ...f, color: null, directors: ['A filmmaker'] })) }), getFilms: async () => films, toCard: f => ({ ...f, directors: ['A filmmaker'], countries: [], languages: [], genres: [], runtime: null, wins: 0 }) };
    if (id === '@/lib/community') return { MIN_FILMS: 5, getCommunityCollections: async () => collectionTiles };
    if (id === './Transitions' || id === '@/components/Transitions') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === './QuickSave') return { __esModule: true, default: () => null };
    if (id.endsWith('.json')) return require(resolve(root, id.replace('@/', '')));
    if (id.endsWith('/bulk-actions')) return { bulkFilmChange: noop };
    if (id.endsWith('/actions') || id === '../actions') return new Proxy({}, { get: () => noop });
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? resolve(root, id.slice(2)) : resolve(dirname(file), id);
      const target = ['.tsx', '.ts', ''].map(ext => base + ext).find(existsSync);
      if (target) return load(target);
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const Layout = load(resolve(root, 'app/admin/layout.tsx')).default;
const Home = load(resolve(root, 'app/admin/page.tsx')).default;
const Films = load(resolve(root, 'app/admin/films/page.tsx')).default;
const People = load(resolve(root, 'app/admin/people/page.tsx')).default;
const Members = load(resolve(root, 'app/admin/members/page.tsx')).default;
const Editorial = load(resolve(root, 'app/admin/editorial/page.tsx')).default;
const Community = load(resolve(root, 'app/admin/community/page.tsx')).default;
const PersonEditor = load(resolve(root, 'app/admin/people/[id]/PersonEditor.tsx')).default;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const font = readFileSync(resolve(root, 'app/fonts/Inter-Latin.woff2')).toString('base64');
const css = readFileSync(resolve(root, 'app/globals.css'), 'utf8') + `\n@font-face { font-family: FixtureInter; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; } :root { --font-inter: FixtureInter; --font-inter-ext: FixtureInter; }`;
const artifacts = process.env.ADMIN_SCREENSHOTS;
if (artifacts) mkdirSync(artifacts, { recursive: true });
let checks = 0;
try {
  for (const theme of ['dark', 'light']) {
    for (const width of [320, 390, 600, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const grid of ['large', 'small', 'list']) {
      for (const screen of ['overview', 'films', 'people', 'members', 'editorial', 'community', 'editor']) {
        pathname = screen === 'overview' ? '/admin' : screen === 'editor' ? '/admin/people/fixture' : `/admin/${screen}`;
        const content = screen === 'overview' ? await Home() : screen === 'films'
          ? await Films({ searchParams: Promise.resolve({}) })
          : screen === 'people' ? await People({ searchParams: Promise.resolve({}) })
          : screen === 'members' ? await Members({ searchParams: Promise.resolve({}) })
          : screen === 'editorial' ? await Editorial({ searchParams: Promise.resolve({}) })
          : screen === 'community' ? await Community({ searchParams: Promise.resolve({}) })
          : React.createElement(PersonEditor, { person: { id: 'person', name: film.title, slug: 'fixture', country: 'SN', birth_year: 1970, bio: 'A filmmaker biography.', photo_url: null, is_director: true } });
        const html = renderToStaticMarkup(await Layout({ children: content }));
        await page.setContent(`<!doctype html><html data-theme="${theme}" data-grid="${grid}"><head><style>${css}</style></head><body>${html}</body></html>`);
        if (screen === 'films') await page.locator('.admin-toolbox').evaluate(el => { el.open = true; });
        await page.evaluate(() => document.fonts.ready);
        const prefix = `${theme}/${width}/${grid}/${screen}`;
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${prefix}: page overflows`);
        assert.equal(await page.locator('.admin-main-tabs [aria-current="page"]').count(), 1, `${prefix}: active main tab`);
        assert.equal(await page.locator('.admin-main-tabs a .icon').count(), 8, `${prefix}: tab icons`);
        assert.equal(await page.locator('.admin-main-tabs [aria-current="page"]').getAttribute('href'), screen === 'overview' ? '/admin' : screen === 'editor' ? '/admin/people' : `/admin/${screen}`);
        const tooWide = await page.locator('.admin-content .button, .admin-content input:not([type="hidden"]), .admin-content textarea, .admin-content select').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().right > innerWidth || el.getBoundingClientRect().left < 0).map(el => el.outerHTML.slice(0, 150)));
        assert.deepEqual(tooWide, [], `${prefix}: overflowing controls`);
        if (screen === 'films') {
          assert.equal(await page.locator('.admin-film-grid .film-card').count(), films.length, `${prefix}: real film cards`);
          assert.equal(await page.locator('.admin-table').count(), 0, `${prefix}: no catalog table`);
          assert.equal(await page.locator('.admin-film-grid .film-card > a').first().getAttribute('href'), `/admin/films/${film.id}`, `${prefix}: edit link`);
          for (const selector of ['.admin-films', '.admin-browser-tools', '.admin-bulk-bar', '.admin-toolbox', '.admin-film-grid .film-card']) {
            assert(await page.locator(selector).first().evaluate(el => el.getBoundingClientRect().width <= innerWidth), `${prefix}: ${selector} stays within screen`);
          }
          const filterDialog = page.locator('dialog');
          await filterDialog.evaluate(el => el.showModal());
          assert(await filterDialog.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), `${prefix}: filter sheet fits`);
          const values = await filterDialog.locator('form').evaluate(el => Object.fromEntries(new FormData(el)));
          assert.deepEqual(values, { q: '', status: '', type: '', missing: '' }, `${prefix}: server filter fields`);
          await filterDialog.evaluate(el => el.close());
          await page.getByRole('checkbox', { name: 'Select page' }).focus();
          assert(await page.getByRole('checkbox', { name: 'Select page' }).evaluate(el => el === document.activeElement), `${prefix}: keyboard focus`);
        }
        if (screen === 'people' || screen === 'members') {
          assert(await page.locator('.director-grid .director-card').count() > 0, `${prefix}: shared director/profile cards`);
          assert.equal(await page.locator('.admin-table').count(), 0, `${prefix}: no directory table`);
        }
        if (screen === 'editorial') assert.equal(await page.locator('.film-grid .film-card').count(), films.length, `${prefix}: editorial poster cards`);
        if (screen === 'community') assert.equal(await page.locator('.collection-list .collection-tile').count(), collections.length, `${prefix}: shared collection tiles`);
        assert.equal(await page.locator('.account-page > .page-head h1').textContent(), 'Admin', `${prefix}: Settings shell`);
        await page.locator('.admin-main-tabs a').last().focus();
        await page.locator('.admin-main-tabs').evaluate(el => { el.scrollLeft = el.scrollWidth; });
        const lastTab = await page.locator('.admin-main-tabs a').last().evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, viewport: innerWidth }; });
        assert(lastTab.left >= -1 && lastTab.right <= lastTab.viewport + 1, `${prefix}: last tab reachable ${JSON.stringify(lastTab)}`);
        await page.locator('.admin-main-tabs [aria-current="page"]').evaluate(el => { document.activeElement?.blur(); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
        if (artifacts && grid === 'large' && [390, 1440].includes(width)) await page.screenshot({ path: resolve(artifacts, `${theme}-${width}-${screen}.png`), fullPage: true });
        checks++;
      }
      }
    }
  }
  // Member contact data and role changes remain restricted to the owner.
  isOwner = false;
  pathname = '/admin/members';
  const restricted = renderToStaticMarkup(await Layout({ children: await Members({ searchParams: Promise.resolve({}) }) }));
  await page.setContent(restricted);
  assert(!restricted.includes('curator@example.com'), 'non-owner must not see member email');
  assert.equal(await page.getByRole('button', { name: 'Remove admin', exact: true }).count(), 0, 'non-owner has no role action');
  isOwner = true;
  // Deep links keep both the owning group and its child selected.
  for (const [path, parent] of [['/admin/quality', '/admin/films'], ['/admin/automation', '/admin/films'], ['/admin/submissions', '/admin/community'], ['/admin/activity', '/admin/analytics']]) {
    pathname = path;
    const html = renderToStaticMarkup(await Layout({ children: null }));
    await page.setContent(html);
    assert.equal(await page.locator('.admin-main-tabs [aria-current="page"]').getAttribute('href'), parent);
    assert.equal(await page.locator('.admin-subtabs [aria-current="page"]').getAttribute('href'), path);
  }
  console.log(`Passed ${checks} responsive component scenarios and 4 nested navigation checks.`);
} finally {
  await browser.close();
}
