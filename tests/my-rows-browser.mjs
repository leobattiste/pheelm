// Follow, Add to Watched and Follow-a-watchlist never send a signed-in member to Sign in while
// they check, read the member's rows once per page however many buttons there are, and a read
// that never answers ends (the button steps aside) instead of waiting forever.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const fakeClient = `
const never = new Promise(() => {});
window.reads = {};
function query(table) {
  const q = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, maybeSingle: () => q, insert: () => q, delete: () => q,
    then(resolve, reject) {
      window.reads[table] = (window.reads[table] ?? 0) + 1;
      if (window.mode.hang) return never.then(resolve, reject);
      const data = table === 'follows' ? [{ person_id: 'p1' }] : table === 'watched' ? [] : table === 'list_saves' ? [{ list_id: 'l1' }] : [];
      return new Promise(r => setTimeout(r, window.mode.slow ?? 0)).then(() => ({ data, error: null })).then(resolve, reject);
    } };
  return q;
}
const client = {
  auth: { getSession: () => Promise.resolve({ data: { session: window.mode.signedOut ? null : { user: { id: 'u1' } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  from: query,
};
export const getBrowserClient = () => client;`;

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import FollowButton from './components/FollowButton';import WatchedButton from './components/WatchedButton';import SaveCollectionButton from './components/SaveCollectionButton';
createRoot(document.getElementById('root')).render(<><div id="f1"><FollowButton personId="p1" name="Ava"/></div><div id="f2"><FollowButton personId="p2" name="Ryan"/></div><div id="w"><WatchedButton filmId="x1"/></div><div id="s"><SaveCollectionButton listId="l1" ownerId="someone"/></div></>);`, resolveDir: process.cwd(), loader: 'tsx' },
  define: { 'process.env': '{}' }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.json',
  plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'client', namespace: 'fake' }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fake' }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fake' }));
    b.onResolve({ filter: /SignInSheet$/ }, () => ({ path: 'signin', namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, ({ path }) => ({
      resolveDir: process.cwd(), loader: 'jsx',
      contents: path === 'client' ? fakeClient
        : path === 'navigation' ? `export const useRouter=()=>({push(){},refresh(){},replace(){}});export const usePathname=()=>'/x';export const useSearchParams=()=>new URLSearchParams();`
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
    return { page, errors };
  };

  // A slow database: while it checks, the buttons wait; none links to Sign in.
  {
    const { page, errors } = await open({ slow: 1500 });
    await page.waitForTimeout(400);
    assert.equal(await page.locator('a[href^="/login"]').count(), 0, 'no Sign in links for a signed-in member');
    assert.equal(await page.locator('button[aria-busy="true"]:disabled').count(), 4);
    await page.locator('#f1 button[aria-pressed="true"]').waitFor();
    assert.equal(await page.locator('#f2 button').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#w button').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#s button').getAttribute('aria-pressed'), 'true');
    const reads = await page.evaluate(() => window.reads);
    assert.deepEqual(reads, { follows: 1, watched: 1, list_saves: 1 }, 'one read per kind for the whole page');
    assert.deepEqual(errors, []);
    await page.close();
  }

  // A read that never answers: the buttons step aside after the time limit instead of waiting.
  {
    const { page, errors } = await open({ hang: true });
    await page.waitForTimeout(400);
    assert.equal(await page.locator('a[href^="/login"]').count(), 0);
    await page.waitForFunction(() => document.querySelectorAll('#root button').length === 0, null, { timeout: 15000 });
    assert.deepEqual(errors, []);
    await page.close();
  }

  // Signed out: Sign in links, as before.
  {
    const { page } = await open({ signedOut: true });
    await page.waitForFunction(() => document.querySelectorAll('a[href^="/login"]').length === 4);
    await page.close();
  }
  console.log('PASS: Follow / Watched / Follow-watchlist wait without sending members to Sign in, read once per page, and never hang');
} finally { await browser.close(); }
