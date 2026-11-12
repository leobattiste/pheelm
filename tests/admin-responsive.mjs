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
const film = { id: 'fixture', created_at: '2026-11-07', updated_at: '2026-11-07', slug: 'fixture', title: 'A very long film title that should remain readable on the smallest screen', year: 2026, type: 'documentary', status: 'draft', poster_url: null, featured: true, tmdb_id: 123, credits: [{ role: 'director', people: { name: 'A filmmaker with a particularly long name' } }] };
const films = [film, { ...film, id: 'fixture-2', title: 'Atlantics', year: 2019, status: 'published', featured: false }, { ...film, id: 'fixture-3', title: 'Moonlight', year: 2016, status: 'published' }];
const people = [{ id: 'director', slug: 'director', name: 'A filmmaker with a particularly long name', country: 'SN', photo_url: null, bio: null, in_directory: true, directed: 3, credits: [{ role: 'director' }, { role: 'writer' }] }];
const members = [{ id: '33333333-3333-3333-3333-333333333333', handle: 'suspended', display_name: 'A suspended member', email: 'gone@example.com', created_at: '2026-10-01', last_seen: '2026-10-02', is_admin: false, is_owner: false, is_private: false, lists: 1, saved: 2, comments: 3, suspended_at: '2026-11-01', suspended_reason: 'Spam links in comments' }, { id: 'member', handle: 'curator', display_name: 'A member with a particularly long display name', email: 'curator@example.com', created_at: '2026-11-07', last_seen: '2026-11-07', is_admin: true, is_owner: false, is_private: false, lists: 12, saved: 14, comments: 18 }];
const collections = [{ id: 'collection', title: 'A collection of independent cinema', user_id: 'member', hidden: false, staff_pick: true, featured: false, created_at: '2026-11-07', list_films: [{ count: 12 }] }];
const collectionTiles = collections.map(c => ({ ...c, description: null, updated_at: c.created_at, films: films.map(f => ({ ...f, directors: [{ name: 'A filmmaker' }] })), owner: { id: 'member', handle: 'curator', display_name: 'Curator' }, saves: 7, curators: 1 }));
const records = {
  films, people, admin_people_quality: people, lists: collections,
  admin_activity: [{ id: 'change', action: 'Updated film', target_type: 'film', target_id: 'fixture', details: 'Atlantics (2019) · published', created_at: '2026-11-07' }],
  admin_film_quality: [{ id: 'fixture', slug: 'fixture', title: 'Atlantics', year: 2019, status: 'draft', issues: ['poster', 'editorial'], issue_count: 2 }],
  member_profiles: [{ id: 'member', handle: 'curator' }], list_save_counts: [{ list_id: 'collection', saves: 7 }],
  list_reports: [{ id: 'lr', list_id: 'collection', reason: 'Spam in the description', created_at: '2026-11-09', lists: { title: 'A collection of independent cinema', hidden: false } }],
  comment_reports: [{ id: 'cr', created_at: '2026-11-09', reason: 'Rude', comment_id: 'c1', list_comments: { id: 'c1', body: 'A rude comment', list_id: 'collection', removed_at: null, lists: { title: 'A collection' } } }],
  list_comments: [{ id: 'c1', body: 'What a great selection, thank you for putting it together.', list_id: 'collection', user_id: 'member', created_at: '2026-11-09', edited_at: null, removed_at: null, lists: { title: 'A collection of independent cinema' } }],
  submissions: [{ id: 's1', user_id: 'member', title: 'Atlantics', director: 'Mati Diop', year: 2019, link: 'https://example.com/atlantics', note: null, status: 'pending', film_id: null, created_at: '2026-11-08', reviewed_at: null, review_note: null, kind: 'own', details: { submitted_by: 'Mati', email: 'mati@example.com', type: 'feature', synopsis: 'A love story on the coast of Dakar.' } }],
  messages: [
    { id: '11111111-1111-1111-1111-111111111111', name: 'A programmer at a film festival with a long name', email: 'programmer@festival.example', organization: 'Pan-African Film Festival', topic: 'partnership', status: 'new', stage: 'talking', partnership_type: 'Film festival or screening', website: 'https://festival.example', notes: 'Call on Friday.', body: 'We would love to host a Pheelm night at our festival.\n\nWe can offer a screen and a panel.', created_at: '2026-11-10', replied_at: '2026-11-11', due_at: null, closed_at: null, page: null, page_title: null },
    { id: '22222222-2222-2222-2222-222222222222', name: null, email: 'reader@example.com', organization: null, topic: 'privacy', status: 'open', stage: null, partnership_type: null, website: null, notes: null, body: 'Please delete my account data.', created_at: '2026-11-01', replied_at: null, due_at: '2026-12-01', closed_at: null, page: '/films/atlantics', page_title: 'Atlantics' },
  ],
  message_replies: [{ id: 'r1', body: 'Thanks, let us talk.', via: 'pheelm', created_at: '2026-11-11', author_id: 'member' }],
};
const rpcs = {
  admin_members: members,
  admin_moderation_log: [{ id: 1, actor_id: 'member', handle: 'curator', field: 'comment', excerpt: 'A refused comment that was long enough to need wrapping on the narrowest phones we support', reason: 'harassment, hate', created_at: '2026-11-10', total: 1 }],
  admin_newsletter_counts: { total: 4, confirmed: 2, pending: 1, unsubscribed: 1, suppressed: 0 },
  admin_newsletter: [{ email: 'a-reader-with-a-long-address@example.com', source: 'home', created_at: '2026-11-07', state: 'confirmed', confirmed_at: '2026-11-08', unsubscribed_at: null, total: 2 }, { email: 'b@example.com', source: null, created_at: '2026-11-09', state: 'confirmed', confirmed_at: '2026-11-09', unsubscribed_at: null, total: 2 }],
};
const db = { auth: { getUser: async () => ({ data: { user: { id: "member", email: "member@example.com" } } }) }, rpc: async (name) => ({ data: rpcs[name] ?? null, error: null }), from: (table) => {
  let one = false;
  const query = new Proxy({}, { get: (_, key) => key === 'then'
    ? (fn) => Promise.resolve({ count: 128, data: one ? (records[table] ?? [])[0] ?? null : records[table] ?? [] }).then(fn)
    : (key === 'single' || key === 'maybeSingle') ? () => { one = true; return query; } : () => query });
  return query;
} };
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === 'next/navigation') return { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push() {}, replace() {}, refresh() {} }), redirect: () => { throw Error('Unexpected redirect'); }, notFound: () => { throw Error('Unexpected notFound'); } };
    if (id === '@/lib/supabase/server') return { getServerClient: async () => db };
    if (['./NewsletterSubscribe', './EmailForm', './PrivacyForm', './ProfileForm', './NotificationPreferences'].includes(id)) return { __esModule: true, default: () => null };
    if (id === './AccountActions') return { DeleteAccount: () => null, SignOutEverywhere: () => null };
    if (id === '@/lib/admin') return { requireAdmin: async () => ({ db, owner: isOwner, user: { id: "fixture-admin", email: "admin@example.com" } }) };
    if (id === '@/lib/tmdb') return { tmdbEnabled: false };
    if (id === '@/lib/data') return { getDirectors: async () => people, toDirectorSummary: p => ({ ...p, films: 3, first: 2016, last: 2026, previews: films.map(f => ({ ...f, color: null, directors: ['A filmmaker'] })) }), getFilms: async () => films, toCard: f => ({ ...f, directors: ['A filmmaker'], countries: [], languages: [], genres: [], runtime: null, wins: 0 }) };
    if (id === '@/lib/community') return { MIN_FILMS: 5, getCommunityCollections: async () => collectionTiles };
    if (id === './Transitions' || id === '@/components/Transitions') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === './QuickSave') return { __esModule: true, default: () => null };
    if (id.endsWith('.css') || id === 'server-only') return {};
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
const Settings = load(resolve(root, 'app/account/page.tsx')).default;
const Layout = load(resolve(root, 'app/admin/layout.tsx')).default;
const Home = load(resolve(root, 'app/admin/page.tsx')).default;
const Films = load(resolve(root, 'app/admin/films/page.tsx')).default;
const People = load(resolve(root, 'app/admin/people/page.tsx')).default;
const Members = load(resolve(root, 'app/admin/members/page.tsx')).default;
const Editorial = load(resolve(root, 'app/admin/editorial/page.tsx')).default;
const Community = load(resolve(root, 'app/admin/community/watchlists/page.tsx')).default;
const Reports = load(resolve(root, 'app/admin/community/page.tsx')).default;
const Comments = load(resolve(root, 'app/admin/community/comments/page.tsx')).default;
const Refused = load(resolve(root, 'app/admin/community/moderation/page.tsx')).default;
const Submissions = load(resolve(root, 'app/admin/submissions/page.tsx')).default;
const Member = load(resolve(root, 'app/admin/members/[id]/page.tsx')).default;
const Quality = load(resolve(root, 'app/admin/quality/page.tsx')).default;
const Activity = load(resolve(root, 'app/admin/activity/page.tsx')).default;
const Analytics = load(resolve(root, 'app/admin/analytics/page.tsx')).default;
const Automation = load(resolve(root, 'app/admin/automation/page.tsx')).default;
const Inbox = load(resolve(root, 'app/admin/inbox/InboxList.tsx')).default;
const Message = load(resolve(root, 'app/admin/inbox/message/[id]/page.tsx')).default;
const Newsletter = load(resolve(root, 'app/admin/inbox/newsletter/page.tsx')).default;
const PersonEditor = load(resolve(root, 'app/admin/people/[id]/PersonEditor.tsx')).default;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const font = readFileSync(resolve(root, 'app/fonts/Inter-Latin.woff2')).toString('base64');
const css = readFileSync(resolve(root, 'app/globals.css'), 'utf8') + '\n' + readFileSync(resolve(root, 'app/admin/admin.css'), 'utf8') + `\n@font-face { font-family: FixtureInter; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; } :root { --font-inter: FixtureInter; --font-inter-ext: FixtureInter; }`;
const artifacts = process.env.ADMIN_SCREENSHOTS;
if (artifacts) mkdirSync(artifacts, { recursive: true });
let checks = 0;
try {
  for (const theme of ['dark', 'light']) {
    for (const width of [320, 390, 600, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const grid of ['large', 'small', 'list']) {
      for (const screen of ['overview', 'films', 'people', 'members', 'editorial', 'community', 'quality', 'activity', 'analytics', 'automation', 'inbox', 'partnerships', 'message', 'newsletter', 'reports', 'comments', 'refused', 'submissions', 'member', 'editor']) {
        pathname = screen === 'overview' ? '/admin' : screen === 'editor' ? '/admin/people/fixture' : screen === 'partnerships' ? '/admin/inbox/partnerships' : screen === 'message' ? '/admin/inbox/message/11111111-1111-1111-1111-111111111111' : screen === 'newsletter' ? '/admin/inbox/newsletter' : screen === 'community' ? '/admin/community/watchlists' : screen === 'reports' ? '/admin/community' : screen === 'comments' ? '/admin/community/comments' : screen === 'refused' ? '/admin/community/moderation' : screen === 'member' ? '/admin/members/33333333-3333-3333-3333-333333333333' : `/admin/${screen}`;
        const content = screen === 'overview' ? await Home() : screen === 'films'
          ? await Films({ searchParams: Promise.resolve({}) })
          : screen === 'people' ? await People({ searchParams: Promise.resolve({}) })
          : screen === 'members' ? await Members({ searchParams: Promise.resolve({}) })
          : screen === 'editorial' ? await Editorial({ searchParams: Promise.resolve({}) })
          : screen === 'community' ? await Community({ searchParams: Promise.resolve({}) })
          : screen === 'quality' ? await Quality({ searchParams: Promise.resolve({}) })
          : screen === 'activity' ? await Activity({ searchParams: Promise.resolve({}) })
          : screen === 'analytics' ? await Analytics()
          : screen === 'automation' ? await Automation()
          : screen === 'reports' ? await Reports()
          : screen === 'comments' ? await Comments({ searchParams: Promise.resolve({}) })
          : screen === 'refused' ? await Refused({ searchParams: Promise.resolve({}) })
          : screen === 'submissions' ? await Submissions({ searchParams: Promise.resolve({}) })
          : screen === 'member' ? await Member({ params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) })
          : screen === 'inbox' ? await Inbox({ searchParams: Promise.resolve({}) })
          : screen === 'partnerships' ? await Inbox({ box: 'partnerships', searchParams: Promise.resolve({}) })
          : screen === 'message' ? await Message({ params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) })
          : screen === 'newsletter' ? await Newsletter({ searchParams: Promise.resolve({}) })
          : React.createElement(PersonEditor, { person: { id: 'person', name: film.title, slug: 'fixture', country: 'SN', birth_year: 1970, bio: 'A filmmaker biography.', photo_url: null, is_director: true } });
        const html = renderToStaticMarkup(await Layout({ children: content }));
        await page.setContent(`<!doctype html><html data-theme="${theme}" data-grid="${grid}"><head><style>${css}</style></head><body>${html}</body></html>`);
        await page.evaluate(() => document.fonts.ready);
        const prefix = `${theme}/${width}/${grid}/${screen}`;
        const wrongIcons = await page.locator('svg').evaluateAll(icons => icons.filter(icon => {
          const style = getComputedStyle(icon); return style.width !== '24.5px' || style.height !== '24.5px';
        }).map(icon => icon.outerHTML.slice(0, 100)));
        assert.deepEqual(wrongIcons, [], `${prefix}: all admin icons are 24.5px`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${prefix}: page overflows`);
        assert.equal(await page.locator('.admin-main-tabs [aria-current="page"]').count(), 1, `${prefix}: active main tab`);
        assert.equal(await page.locator('.admin-main-tabs a .icon').count(), 0, `${prefix}: admin tabs are text only`);
        assert.equal(await page.locator('.admin-main-tabs [aria-current="page"]').getAttribute('href'), screen === 'overview' ? '/admin' : ['films', 'people', 'editorial', 'editor', 'quality', 'automation'].includes(screen) ? '/admin/films' : screen === 'activity' ? '/admin/analytics' : ['inbox', 'partnerships', 'message', 'newsletter'].includes(screen) ? '/admin/inbox' : ['reports', 'comments', 'refused', 'submissions'].includes(screen) ? '/admin/community' : screen === 'member' ? '/admin/members' : `/admin/${screen}`);
        const tooWide = await page.locator('.admin-content .button, .admin-content input:not([type="hidden"]), .admin-content textarea, .admin-content select').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().right > innerWidth || el.getBoundingClientRect().left < 0).map(el => el.outerHTML.slice(0, 150)));
        assert.deepEqual(tooWide, [], `${prefix}: overflowing controls`);
        if (screen === 'films') {
          assert.equal(await page.locator('.admin-film-grid .film-card').count(), films.length, `${prefix}: real film cards`);
          assert.equal(await page.locator('.admin-table').count(), 0, `${prefix}: no catalog table`);
          assert.equal(await page.locator('.admin-film-grid .film-card > a').first().getAttribute('href'), `/admin/films/${film.id}`, `${prefix}: edit link`);
          for (const selector of ['.admin-films', '.admin-browser-tools', '.admin-film-grid .film-card']) {
            assert(await page.locator(selector).first().evaluate(el => el.getBoundingClientRect().width <= innerWidth), `${prefix}: ${selector} stays within screen`);
          }
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
  // The actual Settings page supplies an icon for every tab, including its hidden panels.
  await page.setViewportSize({ width: 390, height: 900 });
  const settings = renderToStaticMarkup(await Settings());
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${settings}</body></html>`);
  assert.equal(await page.locator('[role="tab"] .icon').count(), 6, 'all six Settings tabs have icons');
  assert.deepEqual(await page.locator('svg').evaluateAll(icons => icons.filter(icon => getComputedStyle(icon).width !== '24.5px' || getComputedStyle(icon).height !== '24.5px').map(icon => icon.outerHTML.slice(0,100))), [], 'Settings icons are 24.5px');
  assert.equal(await page.locator('[role="tab"][aria-selected="true"]').textContent(), 'Profile', 'Settings selected tab keeps its label');
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
