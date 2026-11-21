// The watchlist picker opens with the member's watchlists already listed: they're fetched once,
// ahead of time, as soon as we know who's signed in. A load that never answers ends in "Retry"
// rather than "Loading your watchlists…" forever, and Retry then works.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const fakeClient = `
const never = new Promise(() => {});
window.calls = 0;
function query(table) {
  const q = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, maybeSingle: () => q,
    then(resolve, reject) {
      if (table === 'lists' || table === 'list_members') {
        window.calls++;
        if (window.mode.lists === 'hang' && !window.mode.recovered) return never.then(resolve, reject);
      }
      const data = table === 'lists' ? [{ id: 'l1', title: 'Date night', list_films: [{ film_id: 'f1' }] }, { id: 'l2', title: 'Classics', list_films: [] }]
        : table === 'list_members' ? [{ lists: { id: 'l3', title: 'Shared picks', list_films: [] } }]
        : table === 'watchlist' ? { film_id: 'f1' } : [];
      const later = window.mode.slow ? new Promise(r => setTimeout(r, window.mode.slow)) : Promise.resolve();
      return later.then(() => ({ data, error: null })).then(resolve, reject);
    } };
  return q;
}
const client = {
  auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  from: query, rpc: () => Promise.resolve({ data: null, error: null }),
};
export const getBrowserClient = () => client;`;

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import WatchlistButton from './components/WatchlistButton';createRoot(document.getElementById('root')).render(<WatchlistButton filmId="f1" filmTitle="Film"/>);`, resolveDir: process.cwd(), loader: 'tsx' },
  define: { 'process.env': '{}' }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.json',
  plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'client', namespace: 'fake' }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fake' }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fake' }));
    b.onResolve({ filter: /SignInSheet$/ }, () => ({ path: 'signin', namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, ({ path }) => ({
      resolveDir: process.cwd(), loader: 'jsx',
      contents: path === 'client' ? fakeClient
        : path === 'navigation' ? `export const useRouter=()=>({push(){},refresh(){},replace(){}});export const usePathname=()=>'/films/f';export const useSearchParams=()=>new URLSearchParams();`
        : path === 'signin' ? `export const openSignIn=()=>false;`
        : `import React from 'react';export default React.forwardRef(({href,children,prefetch,scroll,replace,...p},ref)=><a ref={ref} href={href} {...p}>{children}</a>);`,
    }));
  } }],
});

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
try {
  const open = async (mode) => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => r.abort());
    await page.setContent('<html><body><div id="root"></div></body></html>');
    await page.evaluate((m) => { window.mode = m; }, mode);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.locator('[data-action="watchlist"]:not([disabled])').waitFor();
    return { page, errors };
  };

  // Each load is slow (1.5s), like a busy database; the page has been open longer than that.
  {
    const { page, errors } = await open({ slow: 1500 });
    await page.waitForFunction(() => window.calls >= 2);
    await page.waitForTimeout(1700);
    await page.locator('[data-action="watchlist"]').click();
    // Listed at once, from the copy fetched ahead of time.
    await page.getByRole('checkbox', { name: /Date night/ }).waitFor({ timeout: 300 });
    assert.equal(await page.getByRole('checkbox', { name: /Date night/ }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('checkbox', { name: /Classics/ }).getAttribute('aria-checked'), 'false');
    await page.getByRole('checkbox', { name: /Shared picks/ }).waitFor();
    assert.equal(await page.getByText('Loading your watchlists…').count(), 0);
    // Close and reopen: still instant, and no new load for nothing.
    const before = await page.evaluate(() => window.calls);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.locator('[data-action="watchlist"]').click();
    await page.getByRole('checkbox', { name: /Date night/ }).waitFor({ timeout: 300 });
    assert.equal(await page.evaluate(() => window.calls), before);
    assert.deepEqual(errors, []);
    await page.close();
  }

  // A load that never answers: Retry appears (no endless Loading), and Retry works.
  {
    const { page, errors } = await open({ lists: 'hang' });
    await page.locator('[data-action="watchlist"]').click();
    await page.getByText('Loading your watchlists…').waitFor();
    await page.getByRole('button', { name: 'Retry loading watchlists' }).waitFor({ timeout: 15000 });
    await page.evaluate(() => { window.mode.recovered = true; });
    await page.getByRole('button', { name: 'Retry loading watchlists' }).click();
    await page.getByRole('checkbox', { name: /Date night/ }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: the watchlist picker opens with the lists already there, and a stuck load ends in a working Retry');
} finally { await browser.close(); }
