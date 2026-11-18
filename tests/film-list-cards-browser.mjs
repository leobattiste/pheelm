import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{FilmGrid}from'./components/FilmCard';import DirectorCard from'./components/DirectorCard';import CommunityTile from'./components/CommunityTile';import GridToggle from'./components/GridToggle';
  const films=[{id:'one',slug:'one',title:'A Very Long Film Title '+ 'Unbroken'.repeat(20),year:2024,type:'feature',countries:['US'],languages:['English'],genres:['Drama'],runtime:105,poster_url:null,color:null,directors:['LongDirectorName'.repeat(15)],wins:0},{id:'two',slug:'two',title:'Another Film',year:2020,type:'documentary',countries:['SN'],languages:['French'],genres:['Documentary'],runtime:90,poster_url:null,color:null,directors:['A Director'],wins:0}];
  createRoot(document.getElementById('root')).render(<><GridToggle/><section id="films"><FilmGrid films={films}/></section><ul className="director-grid"><DirectorCard director={{id:'director',slug:'director',name:'Director',country:'US',photo_url:null,films:2,first:2020,last:2024,previews:[]}}/></ul><ul className="collection-list"><CommunityTile c={{id:'list',slug:'list',title:'A watchlist',owner:{handle:'member'},films:[]}}/></ul></>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env': '{}' },
  plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    b.onResolve({ filter: /supabase\/client$/ }, () => ({ path: 'client', namespace: 'fixture' }));
    b.onResolve({ filter: /SignInSheet$/ }, () => ({ path: 'signin', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'jsx', resolveDir: process.cwd(), contents: {
      navigation: `export const usePathname=()=>'/films';export const useRouter=()=>({push(){}});`,
      link: `import React from'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
      client: `export const getBrowserClient=()=>null;`,
      signin: `export const openSignIn=()=>false;`,
    }[path] }));
  } }],
});
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
const surface = locator => locator.evaluate(el => { const s = getComputedStyle(el); return { bg: s.backgroundColor, border: s.borderTopWidth, color: s.borderTopColor, radius: s.borderTopLeftRadius, padding: s.paddingTop }; });
try {
  for (const width of [320, 390, 900, 1440]) for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(`<html data-theme="${theme}" data-grid="list"><body><main class="page" id="root"></main></body></html>`);
    await page.addStyleTag({ content: fs.readFileSync('app/globals.css', 'utf8') });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const film = page.locator('#films .film-card > a').first();
    await film.waitFor();
    for (const ref of ['.director-grid .collection-tile', '.collection-list .collection-tile']) {
      assert.deepEqual(await surface(film), await surface(page.locator(ref)), `film card matches ${ref} at ${width}/${theme}`);
    }
    assert.equal((await surface(film)).border, '1px');
    assert.equal((await surface(film)).radius, '18px');
    assert.equal((await surface(film)).padding, '12px');
    assert.equal(await film.getAttribute('href'), '/films/one');
    const poster = await film.locator('.poster').boundingBox();
    const title = await film.locator('.film-card-title').boundingBox();
    const meta = await film.locator('.film-card-meta').boundingBox();
    assert.equal(poster.width, 40); assert.equal(poster.height, 60);
    assert(title.x >= poster.x + poster.width && meta.x >= poster.x + poster.width, 'poster left of text');
    assert(meta.y >= title.y, 'details below title');
    assert.equal(await film.locator('.film-card-year').isVisible(), true);
    assert.equal(await film.locator('.film-card-col:visible').count(), 0);
    await film.hover(); assert.equal((await surface(film)).border, '1px');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}/${theme}: no overflow`);
    for (const mode of [0, 1]) {
      await page.locator('.grid-toggle button').nth(mode).click();
      assert.equal((await surface(film)).border, '0px', 'poster grid stays borderless');
      assert((await film.locator('.poster').boundingBox()).width > 40, 'poster grid stays full size');
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: film list cards match director/watchlist surfaces, poster-left layout, long text, both themes and responsive widths; poster grids unchanged');
} finally { await browser.close(); }
