// Admin → Send: choosing the kind, audience and channels updates who it reaches; a newsletter is
// email to subscribers only; sending asks for confirmation with the count, any change asks again,
// and the confirmed count goes to the server. Only the owner can send. Fits a phone.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fakeActions = `
window.calls = [];
const counts = (d) => d.kind === 'newsletter' ? { audience: 12, recipients: 12, in_app: 0, emails: 12 }
  : d.audience === 'followers' ? { audience: 3, recipients: 2, in_app: d.channels.includes('in_app') ? 2 : 0, emails: d.channels.includes('email') ? 1 : 0 }
  : { audience: 40, recipients: d.channels.length === 2 ? 38 : 30, in_app: d.channels.includes('in_app') ? 38 : 0, emails: d.channels.includes('email') ? 30 : 0 };
export async function previewReach(d) { window.calls.push(['preview', JSON.parse(JSON.stringify(d))]); await new Promise(r => setTimeout(r, window.slow || 0)); return { ok: true, ...counts(d) }; }
export async function sendTest(d) { window.calls.push(['test', d]); return { ok: true, message: 'Test sent to owner@example.com. It arrives within about 5 minutes.' }; }
export async function sendCampaign(d, expected) { window.calls.push(['send', d, expected]); return { ok: true, message: 'Sent: 38 in-app and 30 emails.' }; }`;

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import SendForm from './app/admin/inbox/send/SendForm';
    const targets={directors:[{id:'11111111-1111-4111-8111-111111111111',label:'Raoul Peck',count:3}],films:[],members:[{id:'22222222-2222-4222-8222-222222222222',label:'Fan (@fan)'}]};
    createRoot(document.getElementById('root')).render(<main className="page admin"><SendForm targets={targets} owner={window.owner}/></main>);`, resolveDir: process.cwd(), loader: 'tsx' },
  define: { 'process.env': '{}' }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.json',
  plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^\.\/actions$/ }, () => ({ path: 'actions', namespace: 'fake' }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, ({ path }) => ({ resolveDir: process.cwd(), loader: 'js',
      contents: path === 'actions' ? fakeActions : `export const useRouter=()=>({refresh(){window.refreshed=true},push(){},replace(){}});` }));
  } }],
});
const css = fs.readFileSync('app/globals.css', 'utf8') + fs.readFileSync('app/admin/admin.css', 'utf8');

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
try {
  const open = async ({ owner = true, width = 1100 } = {}) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => r.abort());
    await page.setContent('<html><body><div id="root"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.evaluate((o) => { window.owner = o; }, owner);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    return { page, errors };
  };
  const reach = (page) => page.locator('.admin-send-reach');
  const last = (page, kind) => page.evaluate((k) => window.calls.filter((c) => c[0] === k).at(-1), kind);

  {
    const { page, errors } = await open();
    await assert.doesNotReject(reach(page).filter({ hasText: 'Reaches 38 people: 38 in-app, 30 by email.' }).waitFor());
    assert.match(await reach(page).textContent(), /2 others won.t: they turned it off, or their email bounced\./);
    // Nothing written yet: nothing to send or test.
    assert.ok(await page.getByRole('button', { name: 'Send to 38 people' }).isDisabled());
    assert.ok(await page.getByRole('button', { name: 'Send test to me' }).isDisabled());

    // Email only.
    await page.getByLabel('In-app notification').uncheck();
    await reach(page).filter({ hasText: 'Reaches 30 people: 30 by email.' }).waitFor();
    assert.deepEqual((await last(page, 'preview'))[1].channels, ['email']);
    await page.getByLabel('In-app notification').check();

    // Followers of a director: choose one first.
    await page.getByLabel('Audience').selectOption('followers');
    await reach(page).filter({ hasText: 'Choose the director.' }).waitFor();
    await page.getByLabel('Director').selectOption({ label: 'Raoul Peck (3)' });
    await reach(page).filter({ hasText: 'Reaches 2 people: 2 in-app, 1 by email. 1 other won' }).waitFor();
    const followers = (await last(page, 'preview'))[1];
    assert.equal(followers.audience, 'followers'); assert.equal(followers.ref, '11111111-1111-4111-8111-111111111111');

    // Newsletter: subscribers, email only; the audience and channel choices go away.
    await page.getByRole('button', { name: 'Newsletter' }).click();
    await reach(page).filter({ hasText: 'Reaches 12 people.' }).waitFor();
    assert.equal(await page.getByLabel('Audience').count(), 0);
    assert.equal(await page.getByLabel('In-app notification').count(), 0);
    const news = (await last(page, 'preview'))[1];
    assert.equal(await page.getByRole('button', { name: 'Newsletter' }).getAttribute('aria-pressed'), 'true');
    assert.equal(news.audience, 'subscribers'); assert.deepEqual(news.channels, ['email']); assert.equal(news.ref, null);

    // Back to an announcement to all members, and write it.
    await page.getByRole('button', { name: 'Announcement' }).click();
    await page.getByLabel('Audience').selectOption('members');
    await reach(page).filter({ hasText: 'Reaches 38 people' }).waitFor();
    await page.getByLabel('Subject').fill('New on Pheelm');
    await page.getByLabel('Message').fill('Hello.\n\nWe added things.');
    await page.getByLabel('Button link').fill('pheelm.com/films');
    await page.getByLabel('Button text').fill('See films');

    await page.getByRole('button', { name: 'Send test to me' }).click();
    await page.getByText('Test sent to owner@example.com').waitFor();
    const tested = (await last(page, 'test'))[1];
    assert.equal(tested.subject, 'New on Pheelm'); assert.equal(tested.link, 'pheelm.com/films'); assert.equal(tested.label, 'See films');

    // Send asks first; changing the message asks again.
    await page.getByRole('button', { name: 'Send to 38 people' }).click();
    await page.getByText(/^Send to 38 people now\? This can.t be undone\.$/).waitFor();
    await page.getByLabel('Message').fill('Hello.\n\nWe added more things.');
    assert.equal(await page.getByRole('button', { name: 'Yes, send' }).count(), 0, 'an edit cancels the confirmation');
    await page.getByRole('button', { name: 'Send to 38 people' }).click();
    await page.getByRole('button', { name: 'Yes, send' }).click();
    await page.getByText('Sent: 38 in-app and 30 emails.').waitFor();
    const [, sent, expected] = await last(page, 'send');
    assert.equal(expected, 38, 'the confirmed count goes to the server');
    assert.equal(sent.message, 'Hello.\n\nWe added more things.'); assert.deepEqual(sent.channels, ['in_app', 'email']); assert.equal(sent.audience, 'members');
    assert.equal(await page.getByLabel('Subject').inputValue(), '', 'the form clears after sending');
    assert.ok(await page.evaluate(() => window.refreshed), 'the Sent list refreshes');
    assert.deepEqual(errors, []);
    await page.close();
  }

  // A slow count for old choices never shows for new ones.
  {
    const { page } = await open();
    await page.evaluate(() => { window.slow = 600; });
    await page.getByLabel('Audience').selectOption('followers');
    await page.getByLabel('Director').selectOption({ label: 'Raoul Peck (3)' });
    await page.waitForTimeout(100);
    await page.getByLabel('Audience').selectOption('members');
    await page.waitForTimeout(1500);
    assert.match(await reach(page).textContent(), /Reaches 38 people/);
    await page.close();
  }

  // An admin who isn't the owner can test but not send.
  {
    const { page } = await open({ owner: false });
    await page.getByLabel('Subject').fill('Draft');
    await page.getByLabel('Message').fill('Body');
    await reach(page).filter({ hasText: 'Reaches 38 people' }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Send to 38 people' }).isDisabled());
    assert.ok(!(await page.getByRole('button', { name: 'Send test to me' }).isDisabled()));
    await page.getByText('Only the owner can send.').waitFor();
    await page.close();
  }

  // Fits a phone.
  for (const width of [320, 390]) {
    const { page } = await open({ width });
    await reach(page).filter({ hasText: 'Reaches' }).waitFor();
    await page.getByLabel('Audience').selectOption('followers');
    const wide = await page.evaluate(() => [...document.querySelectorAll('.admin-send *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.className || el.tagName));
    assert.deepEqual(wide, [], `nothing wider than ${width}px`);
    await page.close();
  }
  console.log('PASS: Send counts who it reaches by audience and channel, newsletters are email to subscribers, sending confirms the count and any change asks again, only the owner sends, and it fits a phone.');
} finally { await browser.close(); }
