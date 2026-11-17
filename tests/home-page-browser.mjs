// Render the actual async homepage and its real cards/actions against a public-catalog fixture.
// This complements the running app's smoke check, which uses the unconfigured starter catalog.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const svg = (color, label) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="${color}"/><circle cx="300" cy="280" r="160" fill="#ffffff" opacity=".12"/><text x="50" y="700" fill="white" font-family="sans-serif" font-size="44">${label}</text></svg>`).toString('base64')}`;
const colors = ['#684a35', '#28585e', '#6a364b', '#38543c', '#57436b', '#8a5935', '#254a69', '#795447'];
const people = colors.map((color, i) => ({ id: `director-${i}`, slug: `director-${i}`, name: ['Amina Johnson', 'Ousmane Diallo', 'Nia Williams', 'Maya Lewis', 'Kwame Mensah', 'Imani James', 'Zora Thomas', 'Ada Okafor'][i], country: ['US', 'SN', 'GB', 'US', 'GH', 'JM', 'BR', 'NG'][i], photo_url: svg(color, 'Director'), bio: 'A filmmaker exploring memory, identity and the everyday stories that connect us. Discover their work through a growing collection of films.', in_directory: true }));
const films = colors.map((color, i) => ({ id: `film-${i}`, tmdb_id: 100 + i, slug: `film-${i}`, title: ['A Place Between Worlds', 'The River Remembers', 'After the Rain', 'An Ordinary Day', 'Letters from Home', 'City of Light', 'Across the Water', 'A New Morning'][i], year: 2020 + i % 5, type: i === 2 ? 'documentary' : i === 3 ? 'short' : 'feature', countries: [people[i].country], languages: ['English'], genres: ['Drama'], runtime: 96, synopsis: 'A journey through the places and people we carry with us.', note: i === 0 ? 'An intimate story of belonging, told through the people who make a place feel like home.' : null, status: 'published', featured: i === 0, color, poster_url: svg(color, 'Pheelm'), backdrop_url: i === 0 ? svg(color, '') : null, trailer_url: null, awards: [], watch: [], directors: [people[i]], credits: [{ person: people[i], role: 'director' }], collections: [] }));
const directors = people.map((person, i) => ({ ...person, films: [films[i], films[(i + 1) % films.length], films[(i + 2) % films.length]] }));
const collection = (id, title, indexes, featured = false) => ({ id, slug: id, title, films: indexes.map(i => films[i]), featured, staff_pick: false, description: 'A selection by the community.', created_at: '2026-01-01', updated_at: '2026-01-01', saves: 0, curators: 1, owner: { id: `owner-${id}`, handle: id, display_name: id } });
const collections = [collection('first', 'Journeys of belonging', [0, 1, 2, 3, 4], true), collection('second', 'A different perspective', [1, 2, 3, 4, 5], true), collection('third', 'Stories across borders', [1, 3, 5, 6, 7], true), collection('ordinary', 'Not a featured selection', [1, 0, 2, 6, 7])];

const bundle = await build({
  stdin: { contents: `import React from'react';import{createRoot}from'react-dom/client';import Home from'./app/home/page';import{cleanState}from'./lib/catalog-search';window.cleanSearch=search=>cleanState(new URLSearchParams(search),'films');Home().then(element=>createRoot(document.getElementById('root')).render(element));`, resolveDir: process.cwd(), loader: 'tsx' },
  define: { 'process.env': '{}' }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.json', outdir: '/tmp/pheelm-home-browser',
  plugins: [{ name: 'homepage-fixture', setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    b.onResolve({ filter: /^@\/lib\/data$/ }, () => ({ path: 'data', namespace: 'fixture' }));
    b.onResolve({ filter: /^@\/lib\/community$/ }, () => ({ path: 'community', namespace: 'fixture' }));
    b.onResolve({ filter: /^@\/lib\/home-popularity$/ }, () => ({ path: 'popularity', namespace: 'fixture' }));
    b.onResolve({ filter: /^@\/lib\/seo$/ }, () => ({ path: 'seo', namespace: 'fixture' }));
    b.onResolve({ filter: /supabase\/(client|server)$/ }, ({ path }) => ({ path: path.endsWith('server') ? 'server' : 'client', namespace: 'fixture' }));
    b.onResolve({ filter: /SignInSheet$/ }, () => ({ path: 'signin', namespace: 'fixture' }));
    b.onResolve({ filter: /\/Toast$/ }, () => ({ path: 'toast', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: {
      navigation: `export const usePathname=()=>'/home';export const useRouter=()=>({refresh(){},push(href){history.pushState({},'',href)}});export function redirect(href){throw Error('Unexpected redirect: '+href)}`,
      link: `import React from'react';export default function Link({href,children,onClick,...props}){return <a href={href} {...props} onClick={e=>{onClick?.(e);if(!e.defaultPrevented){e.preventDefault();history.pushState({},'',href)}}}>{children}</a>}`,
      data: `export{toCard,toDirectorSummary}from'./lib/data.ts';export const getFilms=async()=>window.homeFixture.films;export const getDirectors=async()=>window.homeFixture.directors;`,
      community: `export const getCommunityCollections=async()=>window.homeFixture.collections;`,
      popularity: `export const getPopularMovieIds=async()=>[106,107,100,104,102,103];`,
      seo: `export const privateMetadata=()=>({});`,
      server: `export const getServerClient=async()=>({auth:{getUser:async()=>({data:{user:{id:'member'}}})},from(){return{select(){return this},eq:async()=>({data:[]})}}});`,
      client: `const followed=new Set();window.followedFixture=followed;export function getBrowserClient(){return{auth:{getSession:async()=>({data:{session:{user:{id:'member'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(table){const filters={};let removing=false;const query={select(){return query},eq(k,v){filters[k]=v;return query},order(){return query},delete(){removing=true;return query},insert(row){followed.add(row.person_id);return Promise.resolve({error:null})},maybeSingle:async()=>({data:table==='follows'&&followed.has(filters.person_id)?{person_id:filters.person_id}:null}),then(resolve){if(removing)followed.delete(filters.person_id);return Promise.resolve({data:[],error:null}).then(resolve)}};return query}}}`,
      signin: `export function openSignIn(){return false}export default function SignInSheet(){return null}`,
      toast: `export const toast={success(){},error(message){throw Error(message)}};`,
    }[path], loader: 'jsx', resolveDir: process.cwd() }));
  } }],
});

const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
const screenshotDir = '/tmp/pheelm-home-screenshots';
fs.mkdirSync(screenshotDir, { recursive: true });
try {
  for (const theme of ['dark', 'light']) for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://pheelm.test/**', route => route.fulfill({ contentType: 'text/html', body: `<html data-theme="${theme}" data-auth="in" data-grid="large" data-chrome="app"><body><main id="root"></main></body></html>` }));
    await page.goto('http://pheelm.test/home');
    await page.evaluate(fixture => { window.homeFixture = fixture; }, { films, directors, collections });
    await page.addStyleTag({ content: fs.readFileSync('app/globals.css', 'utf8') + '\n' + css + `\n@font-face{font-family:FixtureInter;src:url(data:font/woff2;base64,${fs.readFileSync('app/fonts/Inter-Latin.woff2').toString('base64')}) format('woff2');font-weight:100 900}:root{--font-inter:FixtureInter;--font-inter-ext:FixtureInter}` });
    await page.addScriptTag({ content: js });
    await page.getByRole('heading', { name: 'Explore Further', exact: true }).waitFor();
    const directorName = await page.locator('#director-of-week').textContent();
    assert.deepEqual(await page.locator('h2:visible').allTextContents(), [films[0].title, 'Most popular films', 'From the community', directorName, 'Directors to follow', 'Explore Further']);
    assert.equal(await page.getByRole('heading', {name:/^(Film|Director) of the week$/}).count(), 0, 'weekly labels removed');
    assert.equal(await page.locator('.row-title > p').count(), 0, 'section subtitles removed');
    const popular = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Most popular films', exact: true }) });
    assert.equal(await popular.locator('.film-card-title').first().textContent(), films[6].title, 'worldwide chart order wins over public-watchlist counts');
    assert.equal(await popular.locator('.film-card').count(), 6);
    const community = page.locator('section').filter({ has: page.getByRole('heading', { name: 'From the community', exact: true }) });
    assert.equal(await community.locator('.collection-tile').count(), 3);
    assert.equal(await community.getByText('Not a featured selection', { exact: true }).count(), 0);

    assert.ok((await page.locator('#film-of-week').boundingBox()).y >= 0, 'first section heading is not hidden above the viewport');
    const spotlight = page.locator('.person-head');
    const portrait = await spotlight.locator('.portrait').boundingBox();
    const directorTitle = await page.locator('#director-of-week').boundingBox();
    const directorActions = await spotlight.locator('.actions').boundingBox();
    assert.ok(portrait.width >= Math.min(230, width - 70), 'director portrait is large');
    if (width < 900) {
      assert.ok(directorTitle.y >= portrait.y + portrait.height, 'mobile director text is below the photo');
      assert.ok(directorActions.y >= directorTitle.y + directorTitle.height, 'mobile director actions follow text');
    } else {
      assert.ok(directorTitle.x >= portrait.x + portrait.width, 'desktop director text is beside the photo');
      assert.ok(directorActions.x >= portrait.x + portrait.width, 'desktop director actions are beside the photo');
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); }));
    });
    await page.screenshot({ path: `${screenshotDir}/home-${theme}-${width}.png`, fullPage: true });
    const followButtons = page.locator('.follow button');
    await followButtons.first().waitFor();
    assert.equal(await followButtons.count(), 5, 'weekly director and all four suggestions have direct follow controls');
    for (let i = 0; i < await followButtons.count(); i++) {
      const button = followButtons.nth(i);
      await button.evaluate(element => (element.closest('.director-card') ?? element).scrollIntoView({block:'center', inline:'start', behavior:'instant'}));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const clipping = await button.evaluate(element => {
        const box = element.getBoundingClientRect();
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          const bounds = parent.getBoundingClientRect();
          if (['hidden', 'auto', 'scroll', 'clip'].includes(style.overflowY) && (box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1)) return {axis:'y',parent:parent.className,box:box.toJSON(),bounds:bounds.toJSON()};
          if (['hidden', 'auto', 'scroll', 'clip'].includes(style.overflowX) && (box.left < bounds.left - 1 || box.right > bounds.right + 1)) return {axis:'x',parent:parent.className,box:box.toJSON(),bounds:bounds.toJSON()};
        }
        return box.width > 0 && box.height >= 32;
      });
      assert.equal(clipping, true, `${theme} ${width}: follow button ${i} is clipped: ${JSON.stringify(clipping)}`);
      await button.click();
      await page.waitForFunction(index => document.querySelectorAll('.follow button')[index].getAttribute('aria-pressed') === 'true', i);
    }
    assert.equal(await page.evaluate(() => window.followedFixture.size), 5);

    const explore = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Explore Further', exact: true }) });
    for (const [label, type] of [['Documentaries', 'documentary'], ['Short films', 'short']]) {
      await explore.getByRole('link', { name: new RegExp(label) }).click();
      assert.equal(new URL(page.url()).pathname, '/films');
      assert.equal(await page.evaluate(() => window.cleanSearch(location.search).type), type, 'link is accepted by the actual catalog filter parser');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width}: horizontal overflow`);
    assert.deepEqual(errors, [], `${theme} ${width}: script errors`);
    await page.close();
  }
  console.log('PASS: content headings without weekly labels/subtitles, worldwide popularity, featured lists, responsive large director portrait, working Follow buttons and Explore filters, no overflow/errors at 320/390/1440 in light/dark.');
  console.log(`Screenshots: ${screenshotDir}/home-{dark,light}-{320,390,1440}.png`);
} finally { await browser.close(); }
