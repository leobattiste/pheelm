// The comments section on a film page never stays on "Loading comments…" forever.
// A sign-in check that never answers is skipped (comments load as signed out), and a comments
// read that never answers ends in "Comments didn't load. Try again", which then works.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const fakeClient = `
const never = new Promise(() => {});
const rows = [{ id: 'c1', parent_id: null, user_id: 'u1', body: 'Loved it', created_at: '2026-01-01T00:00:00Z', edited_at: null, removed_at: null, spoiler: false, comment_likes: [] }];
function query(table) {
  const q = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, maybeSingle: () => q,
    then(resolve, reject) {
      if (table === 'list_comments' && window.mode.comments === 'hang' && !window.mode.recovered) return never.then(resolve, reject);
      const data = table === 'list_comments' ? rows : table === 'member_profiles' ? [{ id: 'u1', handle: 'ada', display_name: 'Ada' }] : [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    } };
  return q;
}
const client = {
  auth: {
    getSession: () => window.mode.session === 'hang' ? never : Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from: query,
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel() {},
};
export const getBrowserClient = () => client;`;

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import FilmComments from './components/FilmComments';createRoot(document.getElementById('root')).render(<FilmComments filmId="f1" filmTitle="Film"/>);`, resolveDir: process.cwd(), loader: 'tsx' },
  define: { 'process.env': '{}' }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.json',
  plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'client', namespace: 'fake' }));
    b.onResolve({ filter: /comment-actions$/ }, () => ({ path: 'actions', namespace: 'fake' }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fake' }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, ({ path }) => ({
      resolveDir: process.cwd(), loader: 'jsx',
      contents: path === 'client' ? fakeClient
        : path === 'actions' ? `export async function postModeratedComment(){return {}};export async function editModeratedComment(){return {}};`
        : path === 'navigation' ? `export const useRouter=()=>({push(){},refresh(){},replace(){}});export const usePathname=()=>'/films/f';export const useSearchParams=()=>new URLSearchParams();`
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

  // 1. The sign-in check never answers: comments still show, as for a signed-out visitor.
  {
    const { page, errors } = await open({ session: 'hang' });
    await page.getByText('Loved it').waitFor({ timeout: 8000 });
    assert.deepEqual(errors, []);
    await page.close();
  }

  // 2. The comments read never answers: "Try again" appears, and works once the read answers.
  {
    const { page, errors } = await open({ comments: 'hang' });
    await page.getByText('Loading comments…').waitFor();
    await page.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 16000 });
    await page.evaluate(() => { window.mode.recovered = true; });
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByText('Loved it').waitFor({ timeout: 8000 });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: comments load past a stuck sign-in check, and a stuck read ends in a working "Try again".');
} finally {
  await browser.close();
}
