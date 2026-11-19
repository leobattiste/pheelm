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

data.popularFilmIds=films.slice(0,12).map(f=>f.id);
data.followedDirectorIds=['followed-director'];
for(const id of ['eligible-director','followed-director'])data.directors.push({...directors[0],id,title:id,slug:id,aliases:[],count:3,director:{...director,id,slug:id,name:id,films:3}});
films.forEach((film,i)=>film.added=i);
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
const browser = await (process.env.BROWSER==='webkit'?webkit:chromium).launch(process.env.CHROMIUM_PATH&&process.env.BROWSER!=='webkit'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
try {
 const css=fs.readFileSync('app/globals.css','utf8')+'\n'+fs.readFileSync('app/search/search.css','utf8');
 const script=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;
 for(const width of [320,390,1440])for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://pheelm.test/**',r=>r.fulfill({contentType:'text/html',body:`<html data-theme="${theme}" data-chrome="app"><meta charset="utf-8"><style>${css}</style><main class="page unified-search-page" id="root"></main><script>${script}</script></html>`}));
  await page.goto('https://pheelm.test/search');const input=page.locator('input[type=search]');await input.waitFor();
  assert.deepEqual(await page.locator('.search-discovery h2').allTextContents(),['Popular','Recently Added','Explore by Theme','Directors to Follow','From the Community','Explore by Genre']);
  assert.equal(await page.locator('.search-discovery .row').nth(0).locator('.film-card').count(),12);
  assert.equal(await page.locator('.search-discovery .row').nth(3).locator('.director-card').count(),1);
  assert.equal(await page.locator('.search-discovery .row').nth(1).locator('.film-card-title').first().textContent(),'Film 43');
  assert.equal(await page.locator('.unified-controls').count(),0);
  assert.equal(await page.locator('.search-discovery .row').nth(1).locator('.film-card').count(),12);
  assert.equal(await page.locator('.search-discovery a[href="/watchlists/private-list"]').count(),0);
  assert.ok(await page.locator('.search-genres a').first().getAttribute('href').then(h=>h.includes('genre=')));
  assert.equal(await input.getAttribute('placeholder'),'Search films, directors, watchlists, and members…');
  await input.fill('Moonlight');await input.press('Enter');await page.locator('.film-grid').waitFor();assert.equal(await page.locator('.film-grid > li').count(),1);assert.equal(await page.locator('.search-discovery').count(),0);
  const category=async value=>{await page.getByRole('tab',{name:new RegExp('^'+value[0].toUpperCase()+value.slice(1)+' ')}).click();};
  await category('directors');await page.locator('.director-grid').waitFor();assert.equal(await input.inputValue(),'Moonlight');
  await category('watchlists');await page.locator('.collection-list').waitFor();assert.equal(await page.locator('.collection-list > li').count(),1);
  await category('members');await page.locator('.unified-members').waitFor();assert.equal(await page.locator('.unified-members > li').count(),1);
  await page.getByRole('button',{name:'Clear search',exact:true}).click();await page.locator('.search-discovery').waitFor();assert.equal(await input.inputValue(),'');
  await input.fill('zzzzzzzzzzzzzzzz');await input.press('Enter');await page.getByText('Nothing matches your search.',{exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('q'),'zzzzzzzzzzzzzzzz');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: existing discovery rows/cards, public nonempty community, category search, counts, clear/default restore, URL and responsive layouts');
}finally{await browser.close();}
