import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
import { chromium, webkit } from 'playwright-core';

const filmCard = (id, title, overrides = {}) => ({
  id, slug: id, title, year: 1991, type: 'feature', countries: ['SN'], languages: ['French'], genres: ['Drama'],
  runtime: 90, poster_url: null, color: null, directors: ['Ousmane Sembène'], wins: 0, ...overrides,
});
const searchEntry = (card, overrides = {}) => ({
  id: card.id, slug: card.slug, title: card.title, image: null, subtitle: '1991 • Ousmane Sembène', aliases: [],
  names: card.directors, countries: card.countries, languages: card.languages, genres: card.genres, types: [card.type],
  years: [card.year], runtime: card.runtime, wins: 0, nominations: 0, awards: [], availability: [], added: 0, count: 1,
  filmography: [{ year: card.year, type: card.type }], film: card, ...overrides,
});
const moonlight = filmCard('moonlight', 'Moonlight', { year: 2016, countries: ['US'], languages: ['English'], directors: ['Barry Jenkins'] });
const films = [searchEntry(moonlight), ...Array.from({ length: 44 }, (_, i) => searchEntry(filmCard('film-' + i, 'Film ' + String(i).padStart(2, '0'))))];
const director = { id: 'barry', slug: 'barry-jenkins', name: 'Barry Jenkins', country: 'US', photo_url: null, films: 2, first: 2008, last: 2016, previews: [{ slug: 'moonlight', title: 'Moonlight', year: 2016, poster_url: null, color: null, directors: ['Barry Jenkins'] }] };
const directors = [searchEntry(moonlight, { id: 'barry', slug: 'barry-jenkins', title: 'Barry Jenkins', subtitle: 'United States • 2 films', aliases: ['Moonlight'], names: [], count: 2, film: undefined, director })];
const owner = { id: 'viewer', handle: 'leo', display_name: 'Leo' };
const list = (id, title, overrides = {}) => ({
  id, slug: id, title, description: 'Films to discover', is_public: true, featured: false, staff_pick: false, owner,
  filmIds: ['moonlight'], tile: { id, slug: id, title, owner, films: [{ id: 'moonlight', title: 'Moonlight', year: 2016, poster_url: null, color: null, directors: [{ name: 'Barry Jenkins' }] }] },
  updated_at: new Date().toISOString(), created_at: '2026-01-01T00:00:00Z', saves: 2, ...overrides,
});
const data = {
  films, directors, watchlists: [list('moonlight-list', 'Moonlight essentials', { featured: true }), list('private-list', 'Private favorites', { is_public: false })],
  members: [{ id: 'member', handle: 'moonlight_curator', display_name: 'Moonlight Curator', avatar_url: null, country: 'US', bio: 'Film enthusiast', following: true, followsYou: false }],
  signedIn: true, viewerId: 'viewer',
};

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import UnifiedSearch from './components/UnifiedSearch';createRoot(document.getElementById('root')).render(<UnifiedSearch initialData={${JSON.stringify(data)}}/>);`, loader: 'tsx', resolveDir: process.cwd() },
  bundle: true, write: false, format: 'iife', platform: 'browser', outdir: '/tmp/unified-search-test', define: { 'process.env': '{}' },
  plugins: [{ name: 'test-fixtures', setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'test' }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'test' }));
    b.onResolve({ filter: /supabase\/client$/ }, () => ({ path: 'client', namespace: 'test' }));
    b.onResolve({ filter: /SignInSheet$/ }, () => ({ path: 'signin', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({ loader: 'jsx', resolveDir: process.cwd(), contents: {
      navigation: `import{useSyncExternalStore}from'react';const originalReplace=history.replaceState.bind(history);history.replaceState=(...args)=>{originalReplace(...args);dispatchEvent(new Event('test-history'))};const subscribe=fn=>{addEventListener('popstate',fn);addEventListener('test-history',fn);return()=>{removeEventListener('popstate',fn);removeEventListener('test-history',fn)}};export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));const router={push(href){location.assign(href)},replace(href){history.replaceState({},'',href);dispatchEvent(new Event('popstate'))},refresh(){}};export const useRouter=()=>router;`,
      link: `import React from'react';export default function Link({href,children,prefetch,scroll,replace,...props}){return<a href={href} {...props}>{children}</a>}`,
      client: `const callbacks=new Set();const db={auth:{onAuthStateChange(callback){callbacks.add(callback);return{data:{subscription:{unsubscribe(){callbacks.delete(callback)}}}}}}};window.emitSearchAuth=(event,id)=>{for(const callback of callbacks)callback(event,id?{user:{id}}:null)};export const getBrowserClient=()=>window.__enableAuthFixture?db:null;`, signin: `export const openSignIn=()=>false;`,
    }[path] }));
  } }],
});

const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch(process.env.BROWSER !== 'webkit' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
try {
  const css = fs.readFileSync('app/globals.css', 'utf8') + '\n' + fs.readFileSync('app/search/search.css', 'utf8') + '\n' + (bundle.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? '');
  const script = bundle.outputFiles.find(f => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
  for (const width of (process.env.SEARCH_AUTH_ONLY ? [] : [320, 390, 900, 1440])) for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.route('https://pheelm.test/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/search') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-theme="${theme}" data-chrome="app" data-grid="large"><head><meta charset="utf-8"><style>${css}</style></head><body>${url.pathname === '/search' ? `<main class="page unified-search-page" id="root"></main><script>${script}</script>` : '<main><h1>Destination</h1></main>'}</body></html>` });
    });
    const settle = async () => {
      await page.waitForFunction(() => document.querySelector('.unified-search')?.getAttribute('aria-busy') === 'false');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const openSearch = async (query = '') => { await page.goto('https://pheelm.test/search' + query); await page.getByRole('combobox', { name: 'Search films', exact: true }).waitFor(); await settle(); };
    const category = async value => {
      const select = page.getByRole('combobox', { name: 'Search category', exact: true });
      if (await select.isVisible()) await select.selectOption(value);
      else await page.getByRole('tab', { name: value[0].toUpperCase() + value.slice(1), exact: true }).click();
      await page.getByRole('combobox', { name: 'Search ' + value, exact: true }).waitFor();
      await settle();
    };
    const filters = async () => { await page.getByRole('button', { name: /^Filters(?:\s|$)/ }).click(); return page.getByRole('dialog', { name: 'Filters', exact: true }); };
    const closeFilters = async modal => { await modal.getByRole('button', { name: 'Close filters', exact: true }).click(); await settle(); };
    const list = name => page.getByRole('list', { name: name + ' results', exact: true });
    await openSearch();
    assert.equal(await page.locator('.result-count').count(), 0, 'browse mode has no result count');
    assert.equal(await list('Films').locator('> li').count(), 36);
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    assert.equal(await list('Films').locator('> li').count(), 45);
    assert.equal(await page.getByRole('tab', { name: 'All', exact: true }).count(), 0, 'categories do not add an All tab');
    for (const selector of ['.unified-search-bar', '.unified-filter-button']) {
      const rect = await page.locator(selector).boundingBox();
      assert.equal(Math.round(rect.height), 60, `${selector} matches the 60px search control scale`);
    }
    for (const card of await list('Films').locator('> li').all()) {
      const style = await card.evaluate(e => ({ border: getComputedStyle(e).borderTopWidth, background: getComputedStyle(e).backgroundColor }));
      assert.equal(style.border, '0px', 'film results have no card border');
      assert.equal(style.background, 'rgba(0, 0, 0, 0)', 'film results have no card fill');
    }

    const input = page.getByRole('combobox', { name: 'Search films', exact: true });
    const inputStyle = await input.evaluate(e => ({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopWidth}));
    assert.equal(inputStyle.background, 'rgba(0, 0, 0, 0)', 'search input is transparent inside the shared surface');
    assert.equal(inputStyle.border, '0px');
    if (width >= 700) {
      assert.equal(await page.getByRole('tab', {selected:true}).count(), 1);
      const heights = await page.locator('.unified-tabs button').evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().height)));
      assert.ok(heights.every(height => height === 60), 'desktop category controls share the 60px scale');
    } else {
      assert.equal(Math.round((await page.getByRole('combobox', {name:'Search category',exact:true}).boundingBox()).height), 60);
    }
    await input.fill('Moonlight'); await settle();
    assert.equal(await list('Films').locator('> li').count(), 1);
    await page.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'Moonlight');
    assert.equal(new URL(page.url()).searchParams.get('q'), 'Moonlight');
    await input.focus(); await input.click();
    await page.getByRole('listbox', { name: 'Search suggestions', exact: true }).waitFor();
    await input.press('ArrowDown');
    assert.ok(await input.getAttribute('aria-activedescendant'), 'keyboard chooses a suggestion');
    await input.press('Escape');
    assert.equal(await input.getAttribute('aria-expanded'), 'false');
    assert.equal(await input.inputValue(), 'Moonlight', 'Escape does not erase the query');

    let modal = await filters();
    for (const label of ['Genre', 'Country', 'Language', 'From year', 'Through year', 'Minimum runtime', 'Maximum runtime', 'Film type', 'Awards', 'Award or festival', 'Availability', 'Provider', 'Region']) {
      assert.equal(await modal.getByLabel(label, { exact: true }).count(), 1, label + ' film filter');
    }
    const panelStyles = await modal.locator('.modal-body select, .modal-body input:not([type=checkbox])').evaluateAll(es => es.map(e => ({label:e.getAttribute('aria-label') ?? e.closest('label')?.textContent,background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopWidth,height:Math.round(e.getBoundingClientRect().height)})));
    for (const style of panelStyles) {
      assert.equal(style.background, 'rgba(0, 0, 0, 0)', style.label + ' is transparent inside the panel');
      assert.equal(style.border, '0px', style.label + ' has no inner border');
      assert.equal(style.height, 60);
    }
    const panelActions = await modal.locator('.modal-foot button').evaluateAll(es => es.map(e => ({label:e.textContent,background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopWidth})));
    for (const style of panelActions) {
      assert.equal(style.background, 'rgba(0, 0, 0, 0)', style.label + ' panel action is transparent');
      assert.equal(style.border, '0px');
    }
    await modal.getByLabel('Country', { exact: true }).selectOption('US');
    await modal.getByLabel('Genre', { exact: true }).selectOption('Drama');
    const from = modal.getByLabel('From year', { exact: true });
    await from.pressSequentially('2000'); await from.press('Tab');
    const through = modal.getByLabel('Through year', { exact: true });
    await through.pressSequentially('2020'); await through.press('Tab');
    await closeFilters(modal);
    assert.equal(new URL(page.url()).searchParams.get('from'), '2000', 'four-digit years can be typed before committing');
    assert.equal(new URL(page.url()).searchParams.get('to'), '2020');
    assert.equal(await page.getByRole('button', { name: 'Remove United States', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Clear search text', exact: true }).click(); await settle();
    assert.equal(await input.inputValue(), '');
    assert.equal(new URL(page.url()).searchParams.get('country'), 'US', 'query clear keeps filters');
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('q'));
    assert.equal(new URL(page.url()).searchParams.get('q'), null);
    await input.fill('Moonlight'); await settle();
    await page.locator('.unified-result-summary').getByRole('button', { name: 'Clear', exact: true }).click(); await settle();
    assert.equal(await input.inputValue(), 'Moonlight', 'filter Clear keeps the query');
    assert.equal(await page.locator('.unified-chips').count(), 0);

    await category('directors');
    assert.equal(await list('Directors').locator('> li').count(), 1, 'film title finds its director');
    assert.equal(await list('Directors').locator('a').first().getAttribute('href'), '/directors/barry-jenkins');
    modal = await filters();
    for (const label of ['Country', 'Genre', 'From year', 'Through year']) assert.equal(await modal.getByLabel(label, { exact: true }).count(), 1);
    assert.equal(await modal.getByLabel('Minimum runtime', { exact: true }).count(), 0, 'director category hides film-only filters');
    await closeFilters(modal);
    await category('watchlists');
    assert.equal(await list('Watchlists').locator('> li').count(), 1);
    assert.equal(await list('Watchlists').locator('a').first().getAttribute('href'), '/watchlists/moonlight-list');
    modal = await filters();
    for (const label of ['Genre', 'Minimum films', 'Maximum films', 'Recently updated']) assert.equal(await modal.getByLabel(label, { exact: true }).count(), 1);
    await closeFilters(modal);
    await category('members');
    assert.equal(await list('Members').locator('> li').count(), 1);
    assert.equal(await list('Members').locator('a').first().getAttribute('href'), '/@moonlight_curator');
    modal = await filters();
    await modal.getByLabel('Members you follow', { exact: true }).check();
    await modal.getByLabel('Members following you', { exact: true }).check();
    await closeFilters(modal);
    await page.getByText('No members match your search.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Remove Members following you', exact: true }).click(); await settle();
    assert.equal(await list('Members').locator('> li').count(), 1);
    await page.reload(); await settle();
    assert.equal(await page.getByRole('combobox', { name: 'Search members', exact: true }).inputValue(), 'Moonlight');
    assert.equal(await page.getByRole('button', { name: 'Remove Members you follow', exact: true }).count(), 1, 'URL reload preserves contextual filters');
    await category('films');
    assert.equal(new URL(page.url()).searchParams.has('following'), false, 'switching category removes incompatible filters');

    const filmInput = page.getByRole('combobox', { name: 'Search films', exact: true });
    await filmInput.fill('zzzzzzzzzzzzzzzz'); await settle();
    await page.getByText('No films match your search.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Clear search text', exact: true }).click(); await settle();
    await filmInput.fill('Moonlight'); await settle();
    await filmInput.focus(); await filmInput.click();
    await page.getByRole('listbox', { name: 'Search suggestions', exact: true }).waitFor();
    await filmInput.press('ArrowDown'); await filmInput.press('Enter');
    await page.waitForURL('https://pheelm.test/films/moonlight');
    await page.goBack(); await settle();
    assert.equal(await page.getByRole('combobox', { name: 'Search films', exact: true }).inputValue(), 'Moonlight', 'Back restores query');
    await page.getByRole('button', { name: 'Clear search text', exact: true }).click();
    await page.getByRole('combobox', { name: 'Search films', exact: true }).focus();
    await page.getByRole('listbox', { name: 'Recent searches', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Clear history', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('pheelm:search:v1:viewer')), null);
    await settle();
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    const target = list('Films').locator('> li > a').nth(25);
    await target.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    const href = await target.getAttribute('href');
    await target.click(); await page.waitForURL('https://pheelm.test' + href);
    await page.goBack(); await settle();
    assert.equal(await list('Films').locator('> li').count(), 45, 'Back restores expanded results');
    await page.waitForFunction(expected => Math.abs(scrollY - expected) < 25, scroll);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal page overflow');
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`✓ unified search ${width}px ${theme}`);
  }
  // Ignore AbortSignal in this fixture to prove stale responses cannot cross account boundaries.
  const authContext = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  const authPage = await authContext.newPage();
  const authErrors = [];
  authPage.on('pageerror', error => authErrors.push(error.message));
  await authPage.addInitScript(() => {
    window.__enableAuthFixture = true;
    window.__searchPending = [];
    window.resolveSearchResponse = (index, payload) => window.__searchPending[index].resolve({ ok: true, json: async () => payload });
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, options) => new URL(String(input), location.href).pathname === '/api/search'
      ? new Promise(resolve => window.__searchPending.push({ resolve, options }))
      : originalFetch(input, options);
    localStorage.setItem('pheelm:search:v1:viewer', JSON.stringify([{ label: 'Private search', state: { category: 'watchlists', q: 'Private' } }]));
  });
  await authPage.route('https://pheelm.test/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-theme="dark" data-chrome="app" data-grid="large"><head><meta charset="utf-8"><style>${css}</style></head><body><main class="page unified-search-page" id="root"></main><script>${script}</script></body></html>` }));
  await authPage.goto('https://pheelm.test/search?category=watchlists');
  const authList = authPage.getByRole('list', { name: 'Watchlists results', exact: true });
  await authPage.getByText('Private favorites', { exact: true }).waitFor();
  await authPage.getByRole('combobox', { name: 'Search watchlists', exact: true }).focus();
  await authPage.getByRole('button', { name: /Private search/ }).waitFor();
  await authPage.evaluate(() => window.emitSearchAuth('SIGNED_OUT', null));
  await authPage.waitForFunction(() => window.__searchPending.length === 1);
  await authPage.waitForFunction(() => !document.querySelector('.unified-results')?.textContent.includes('Private favorites'));
  assert.equal(await authList.locator('> li').count(), 1, 'sign-out removes own private watchlists before refresh responds');
  assert.equal(await authPage.getByRole('button', { name: /Private search/ }).count(), 0, 'sign-out immediately removes previous-account recent searches');
  const visitorData = { ...data, viewerId: null, signedIn: false, watchlists: data.watchlists.filter(w => w.is_public), members: data.members.map(member => ({ ...member, following: false, followsYou: false })) };
  await authPage.evaluate(payload => window.resolveSearchResponse(0, payload), visitorData);
  await authPage.getByRole('combobox', { name: 'Search category', exact: true }).selectOption('members');
  await authPage.getByRole('link', { name: 'Follow Moonlight Curator', exact: true }).waitFor();
  await authPage.getByRole('button', { name: /^Filters(?:\s|$)/ }).click();
  const authModal = authPage.getByRole('dialog', { name: 'Filters', exact: true });
  assert.equal(await authModal.getByLabel('Members you follow', { exact: true }).isDisabled(), true, 'follow filters require a signed-in viewer');
  await authModal.getByRole('button', { name: 'Close filters', exact: true }).click();
  await authPage.getByRole('combobox', { name: 'Search category', exact: true }).selectOption('watchlists');
  await authPage.evaluate(() => window.emitSearchAuth('SIGNED_IN', 'old-account'));
  await authPage.waitForFunction(() => window.__searchPending.length === 2);
  await authPage.evaluate(() => window.emitSearchAuth('SIGNED_IN', 'new-account'));
  await authPage.waitForFunction(() => window.__searchPending.length === 3);
  assert.equal(await authPage.evaluate(() => window.__searchPending[1].options.signal.aborted), true, 'a newer auth event aborts the older refresh');
  const nextData = { ...data, viewerId: 'new-account', watchlists: [list('new-private', 'New account private', { is_public: false })] };
  await authPage.evaluate(payload => window.resolveSearchResponse(2, payload), nextData);
  await authPage.getByText('New account private', { exact: true }).waitFor();
  const staleData = { ...data, viewerId: 'old-account', watchlists: [list('stale-private', 'Stale account private', { is_public: false })] };
  await authPage.evaluate(payload => window.resolveSearchResponse(1, payload), staleData);
  await authPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await authPage.getByText('Stale account private', { exact: true }).count(), 0, 'late previous-account response cannot reintroduce private results');
  assert.equal(await authPage.getByText('New account private', { exact: true }).count(), 1);
  assert.deepEqual(authErrors, []);
  await authContext.close();
  console.log('PASS: unified categories/filters, keyboard suggestions, URL/reload/back/scroll, recent searches, responsive surfaces, and account-transition privacy with stale-response protection');
} finally {
  await browser.close();
}
