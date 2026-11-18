import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import MemberFollowButton from './components/MemberFollowButton';
  const root=createRoot(document.getElementById('root'));
  window.mountFollow=(props={})=>root.render(<MemberFollowButton memberId="member" name="Ada" viewerId="viewer" initialFollowing={false} {...props} onChange={value=>window.fixture.changes.push(value)}/>);
  window.unmountFollow=()=>root.unmount();
  window.mountFollow();`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env': '{}' },
  plugins: [{ name: 'member-follow-fixtures', setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    b.onResolve({ filter: /supabase\/client$/ }, () => ({ path: 'client', namespace: 'fixture' }));
    b.onResolve({ filter: /SignInSheet$/ }, () => ({ path: 'signin', namespace: 'fixture' }));
    b.onResolve({ filter: /Toast$/ }, () => ({ path: 'toast', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'jsx', resolveDir: process.cwd(), contents: {
      navigation: `export const usePathname=()=>'/search';`,
      link: `import React from'react';export default function Link({href,children,...props}){return<a href={href} {...props}>{children}</a>}`,
      client: `export const getBrowserClient=()=>({from(table){return{
        insert(row){return window.fixture.request({table,action:'insert',row})},
        delete(){const filters=[];return{eq(key,value){filters.push([key,value]);return this},then(resolve,reject){return window.fixture.request({table,action:'delete',filters}).then(resolve,reject)}}}
      }}});`,
      signin: `export const openSignIn=()=>{window.fixture.signins++;return true};`,
      toast: `export const toast={success(message){window.fixture.toasts.push({kind:'success',message})},error(message){window.fixture.toasts.push({kind:'error',message})}};`,
    }[path] }));
  } }],
});

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.evaluate(() => {
    window.fixture = { calls: [], pending: [], changes: [], toasts: [], signins: 0,
      request(call) { this.calls.push(call); return new Promise(resolve => this.pending.push(resolve)); },
    };
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const button = page.getByRole('button');
  await page.getByRole('button', { name: 'Follow Ada', exact: true }).waitFor();
  assert.equal(await button.getAttribute('aria-pressed'), 'false');

  await button.click();
  assert.equal(await button.isDisabled(), true, 'the pending request disables the control');
  assert.equal(await button.getAttribute('aria-busy'), 'true');
  await button.evaluate(element => { element.click(); element.click(); });
  assert.deepEqual(await page.evaluate(() => window.fixture.calls), [
    { table: 'member_follows', action: 'insert', row: { follower_id: 'viewer', followed_id: 'member' } },
  ], 'pending clicks never create duplicate writes');
  await page.evaluate(() => window.fixture.pending.shift()({ error: null }));
  await page.getByRole('button', { name: 'Following Ada. Unfollow', exact: true }).waitFor();
  assert.equal(await button.getAttribute('aria-pressed'), 'true');
  assert.equal(await button.isDisabled(), false);
  assert.deepEqual(await page.evaluate(() => window.fixture.changes), [true]);
  assert.deepEqual(await page.evaluate(() => window.fixture.toasts), [{ kind: 'success', message: 'Following Ada' }]);

  await button.click();
  assert.deepEqual(await page.evaluate(() => window.fixture.calls[1]), {
    table: 'member_follows', action: 'delete', filters: [['follower_id', 'viewer'], ['followed_id', 'member']],
  }, 'unfollow is scoped to the supplied viewer and member');
  await page.evaluate(() => window.fixture.pending.shift()({ error: null }));
  await page.getByRole('button', { name: 'Follow Ada', exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.changes), [true, false]);

  await button.click();
  await page.evaluate(() => window.fixture.pending.shift()({ error: { message: 'Denied by RLS' } }));
  await page.waitForFunction(() => document.querySelector('button')?.getAttribute('aria-busy') === 'false');
  assert.equal(await button.getAttribute('aria-pressed'), 'false', 'a failed follow preserves the prior state');
  assert.deepEqual(await page.evaluate(() => window.fixture.changes), [true, false], 'failed writes never update the result data');
  assert.deepEqual(await page.evaluate(() => window.fixture.toasts.at(-1)), { kind: 'error', message: 'That didn’t save. Try again.' });

  await page.evaluate(() => window.mountFollow({ initialFollowing: true }));
  await page.getByRole('button', { name: 'Following Ada. Unfollow', exact: true }).waitFor();
  await button.click();
  await page.evaluate(() => window.fixture.pending.shift()({ error: { message: 'Network failure' } }));
  await page.waitForFunction(() => document.querySelector('button')?.getAttribute('aria-busy') === 'false');
  assert.equal(await button.getAttribute('aria-pressed'), 'true', 'a failed unfollow preserves the supplied follow state');
  assert.deepEqual(await page.evaluate(() => window.fixture.changes), [true, false]);

  await page.evaluate(() => window.mountFollow({ initialFollowing: false }));
  await page.getByRole('button', { name: 'Follow Ada', exact: true }).waitFor();
  await button.click();
  await page.evaluate(() => window.mountFollow({ viewerId: 'new-viewer', initialFollowing: false }));
  await page.waitForFunction(() => document.querySelector('button')?.getAttribute('aria-busy') === 'false');
  assert.equal(await button.getAttribute('aria-pressed'), 'false', 'an account change resets local follow state');
  await button.click();
  assert.equal(await button.isDisabled(), true);
  await page.evaluate(() => window.fixture.pending.shift()({ error: null }));
  assert.equal(await button.isDisabled(), true, 'an old completion cannot clear a new viewer’s pending state');
  assert.equal(await button.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(await page.evaluate(() => window.fixture.changes), [true, false], 'an old account completion never mutates the new result data');
  assert.equal(await page.evaluate(() => window.fixture.toasts.length), 4, 'stale completions produce no toast');
  assert.deepEqual(await page.evaluate(() => window.fixture.calls.at(-1).row), { follower_id: 'new-viewer', followed_id: 'member' });
  await page.evaluate(() => window.fixture.pending.shift()({ error: null }));
  await page.getByRole('button', { name: 'Following Ada. Unfollow', exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.changes), [true, false, true]);

  await button.click();
  await page.evaluate(() => window.mountFollow({ viewerId: null }));
  await page.getByRole('link', { name: 'Follow Ada', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.pending.shift()({ error: { message: 'Old session expired' } }));
  assert.equal(await page.evaluate(() => window.fixture.toasts.length), 5, 'a signed-out completion produces no stale error');
  assert.deepEqual(await page.evaluate(() => window.fixture.changes), [true, false, true]);

  await page.evaluate(() => window.mountFollow({ viewerId: null }));
  const signIn = page.getByRole('link', { name: 'Follow Ada', exact: true });
  await signIn.waitFor();
  assert.equal(await signIn.getAttribute('href'), '/login?next=%2Fsearch');
  await signIn.click();
  assert.equal(await page.evaluate(() => window.fixture.signins), 1, 'signed-out follow opens the existing sign-in sheet');
  assert.equal(await page.evaluate(() => window.fixture.calls.length), 7, 'signed-out follow never writes');

  await page.evaluate(() => window.mountFollow({ initialFollowing: false }));
  await page.getByRole('button', { name: 'Follow Ada', exact: true }).click();
  await page.evaluate(() => window.mountFollow({ memberId: 'viewer' }));
  await page.waitForFunction(() => document.getElementById('root')?.childElementCount === 0);
  await page.evaluate(() => window.fixture.pending.shift()({ error: null }));
  assert.deepEqual(await page.evaluate(() => window.fixture.changes), [true, false, true], 'a replaced result never emits a stale callback');
  assert.equal(await page.evaluate(() => window.fixture.toasts.length), 5);

  await page.evaluate(() => window.mountFollow({ memberId: 'viewer' }));
  await page.waitForFunction(() => document.getElementById('root')?.childElementCount === 0);
  assert.equal(await page.getByRole('button').count(), 0, 'the viewer cannot follow themselves');

  await page.evaluate(() => window.mountFollow());
  await page.getByRole('button', { name: 'Follow Ada', exact: true }).click();
  await page.evaluate(() => window.unmountFollow());
  await page.evaluate(() => window.fixture.pending.shift()({ error: null }));
  assert.deepEqual(await page.evaluate(() => window.fixture.changes), [true, false, true], 'an unmounted result never emits a stale callback');
  assert.equal(await page.evaluate(() => window.fixture.toasts.length), 5);
  assert.deepEqual(errors, []);
  console.log('PASS: member follow/unfollow writes, callbacks, duplicate protection, failures, account/result changes, sign-in and self controls');
} finally { await browser.close(); }
