// Authenticated integration test against an isolated QA account and a matching built app.
// PHEELM_PICKER_USERS and PHEELM_TEST_CONFIG point to local JSON fixture files, never committed.
// BASE_URL defaults to localhost:3022. QA users must use example.invalid addresses.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');
const base = process.env.BASE_URL ?? 'http://localhost:3022';
if (!process.env.PHEELM_PICKER_USERS || !process.env.PHEELM_TEST_CONFIG) throw new Error('Provide isolated QA fixture file paths in PHEELM_PICKER_USERS and PHEELM_TEST_CONFIG.');
const cfg = JSON.parse(readFileSync(process.env.PHEELM_TEST_CONFIG, 'utf8'));
const user = JSON.parse(readFileSync(process.env.PHEELM_PICKER_USERS, 'utf8'))[0];
assert(user.email.startsWith('pheelm-qa-') && user.email.endsWith('@example.invalid'), 'Only disposable QA accounts are allowed.');
const db = createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
assert.ifError((await db.auth.signInWithPassword({ email: user.email, password: user.password })).error);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
let listId, filmId;
const createdTitle = 'QA picker created in browser';
try {
  const made = await db.from('lists').insert({ user_id: user.id, title: 'QA picker existing' }).select('id').single();
  assert.ifError(made.error); listId = made.data.id;
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await context.addCookies(user.cookies);
  const page = await context.newPage();
  let failSave = false;
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (url.startsWith(base)) return route.continue();
    if (!url.startsWith(cfg.url)) return route.abort();
    if (failSave && url.includes('/rpc/save_film_to_collection')) { failSave = false; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA simulated save failure' }) }); }
    const res = await fetch(url, { method: request.method(), headers: request.headers(), body: request.postDataBuffer() ?? undefined });
    return route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  await page.goto(base + '/films', { waitUntil: 'domcontentloaded' });
  const card = page.locator('.film-card').first();
  await card.hover();
  const href = await card.locator('a').first().getAttribute('href');
  const film = await db.from('films').select('id').eq('slug', href.split('/').at(-1)).single();
  assert.ifError(film.error); filmId = film.data.id;
  const savedCount = async () => (await db.from('watchlist').select('film_id').eq('user_id', user.id).eq('film_id', filmId)).data.length;
  const membershipCount = async () => (await db.from('list_films').select('film_id').eq('list_id', listId).eq('film_id', filmId)).data.length;
  await card.locator('.quick-save').click();
  let dialog = page.locator('dialog.save-sheet[open]');
  await dialog.getByRole('heading', { name: 'Add to Watchlist', exact: true }).waitFor();
  await dialog.getByRole('checkbox', { name: 'QA picker existing', exact: true }).waitFor();
  assert.equal(await savedCount(), 0, 'opening must not save to All');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  assert.equal(await savedCount(), 0, 'dismissal must not save');
  await card.hover(); await card.locator('.quick-save').click();
  dialog = page.locator('dialog.save-sheet[open]');
  failSave = true;
  await dialog.getByRole('checkbox', { name: 'QA picker existing', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(await savedCount(), 0); assert.equal(await membershipCount(), 0);
  assert.equal(await dialog.getByRole('checkbox', { name: 'QA picker existing', exact: true }).getAttribute('aria-checked'), 'false');
  await dialog.getByRole('checkbox', { name: 'QA picker existing', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] [role=checkbox]')].some(e => e.textContent.includes('QA picker existing') && e.getAttribute('aria-checked') === 'true'));
  assert.equal(await savedCount(), 1); assert.equal(await membershipCount(), 1);
  await dialog.getByRole('checkbox').filter({ hasText: 'All' }).click();
  await page.waitForFunction(() => document.querySelector('dialog[open] [role=checkbox]')?.getAttribute('aria-checked') === 'false');
  assert.equal(await savedCount(), 0); assert.equal(await membershipCount(), 0);
  await dialog.getByRole('textbox', { name: 'New watchlist name' }).fill(createdTitle);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await dialog.getByRole('checkbox', { name: createdTitle, exact: true }).waitFor();
  assert.equal(await savedCount(), 1);
  await dialog.getByRole('checkbox').filter({ hasText: 'All' }).click();
  await page.waitForFunction(() => document.querySelector('dialog[open] [role=checkbox]')?.getAttribute('aria-checked') === 'false');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.goto(base + href, { waitUntil: 'domcontentloaded' });
  await page.locator('.film-actions [data-action=watchlist]').click();
  await page.locator('dialog.save-sheet[open]').waitFor();
  assert.equal(await savedCount(), 0, 'film-page picker must not autosave either');
  await page.locator('dialog.save-sheet[open]').getByRole('button', { name: 'Done', exact: true }).click();
  console.log('Passed poster picker with no autosave, cancel, failed save/retry, collection selection, creation, All removal and film-page parity.');
} finally {
  await browser.close();
  if (listId) await db.from('lists').delete().eq('id', listId);
  await db.from('lists').delete().eq('user_id', user.id).eq('title', createdTitle);
  if (filmId) await db.from('watchlist').delete().eq('user_id', user.id).eq('film_id', filmId);
}
