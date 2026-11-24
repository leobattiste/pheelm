// The menu bar tour: opens for a first-time visitor, steps with Next and Back, comes back after a
// refresh, and stops for good on "Don't show again". Automated browsers skip the tour unless the
// pheelm:tour:test flag is set, so this is the only check that sees it.
// Run against a started server: BASE_URL=http://localhost:3000 node tests/tour-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => { try { localStorage.setItem('pheelm:tour:test', '1'); } catch {} });
  const page = await context.newPage();
  await page.goto(`${base}/films`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.tour-card', { timeout: 15000 });
  assert.match(await page.locator('.tour-count').innerText(), /1 of 5/);
  assert.equal(await page.locator('.tour-actions .button.ghost').count(), 0, 'no Back on the first step');
  await page.locator('.tour-actions .button:not(.ghost)').click();
  assert.match(await page.locator('.tour-count').innerText(), /2 of 5/);
  await page.locator('.tour-actions .button.ghost').click();
  assert.match(await page.locator('.tour-count').innerText(), /1 of 5/);

  // Closing and refreshing bring it back, twice more.
  await page.locator('.tour-x').click();
  assert.equal(await page.locator('.tour').count(), 0, 'closed');
  for (const n of [2, 3]) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.tour-card', { timeout: 15000 });
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('pheelm:tour:v1'))).tours.menu.shown, n, `showing ${n}`);
    await page.locator('.tour-x').click();
  }
  // (On a page with no tour of its own, so only the menu tour could show.)
  await page.goto(`${base}/help`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  assert.equal(await page.locator('.tour').count(), 0, 'the menu tour is not shown a fourth time');

  // "Don't show again" and finishing both stop it at once.
  await page.goto(`${base}/films`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('pheelm:tour:v1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.tour-card', { timeout: 15000 });
  await page.locator('.tour-off').click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  assert.equal(await page.locator('.tour').count(), 0, 'off for good');

  // Every card is the same size, as wide as a dialog, with 40px between the words and the buttons.
  await page.evaluate(() => window.dispatchEvent(new Event('pheelm:tour-replay')));
  await page.waitForSelector('.tour-card');
  const sizes = new Set();
  for (let i = 0; i < 5; i++) {
    const b = await page.locator('.tour-card').boundingBox();
    sizes.add(`${Math.round(b.width)}x${Math.round(b.height)}`);
    assert.equal(Math.round(b.width), 350, `as wide as a dialog on a 390px screen: ${b.width}`);
    const gap = await page.evaluate(() => document.querySelector('.tour-actions').getBoundingClientRect().top - document.querySelector('.tour-copy').getBoundingClientRect().bottom);
    assert(Math.abs(gap - 40) < 2, `40px between text and buttons, got ${gap}`);
    if (i === 3) assert.match(await page.locator('.tour-copy-item.is-current').innerText(), /Join the community/);
    if (i < 4) await page.locator('.tour-actions .button:not(.ghost)').click();
  }
  assert.equal(sizes.size, 1, `all cards one size: ${[...sizes]}`);
  assert.equal((await page.locator('.tour-actions .button:not(.ghost)').innerText()), 'Start exploring');
  await page.locator('.tour-x').click();

  // Settings -> Display -> Replay starts it again from the first step, even after "Don't show again".
  await page.evaluate(() => window.dispatchEvent(new Event('pheelm:tour-replay')));
  await page.waitForSelector('.tour-card', { timeout: 15000 });
  assert.match(await page.locator('.tour-count').innerText(), /1 of 5/);
  assert.match(await page.locator('.tour-copy-item.is-current .tour-text').innerText(), /Browse films by Black directors from around the world/);

  // After the menu tour is done, a page's own tour comes up the first time it is visited.
  await page.evaluate(() => localStorage.setItem('pheelm:tour:v1', JSON.stringify({ off: false, tours: { menu: { shown: 1, done: true } } })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.tour-card', { timeout: 15000 });
  assert.match(await page.locator('.tour-copy-item.is-current .tour-title').innerText(), /Search/);
  const films = JSON.parse(await page.evaluate(() => localStorage.getItem('pheelm:tour:v1'))).tours;
  assert.equal(films.films.shown, 1, 'the page tour counted');
  assert.equal(films.menu.done, true, 'the menu tour stays done');
  await page.locator('.tour-actions .button:not(.ghost)').click();
  assert.match(await page.locator('.tour-copy-item.is-current .tour-title').innerText(), /Filter and sort/);
  await page.locator('.tour-actions .button:not(.ghost)').click();
  assert.match(await page.locator('.tour-copy-item.is-current .tour-title').innerText(), /Open a film/);
  assert.equal(await page.locator('.tour-actions .button:not(.ghost)').innerText(), 'Got it');
  await page.locator('.tour-actions .button:not(.ghost)').click();
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('pheelm:tour:v1'))).tours.films.done, true, 'finishing stops it');

  // Directors and Watchlists have their own tours too.
  for (const [path, first] of [['/directors', /Search|Sort/], ['/watchlists', /Browse/]]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.tour-card', { timeout: 15000 });
    assert.match(await page.locator('.tour-copy-item.is-current .tour-title').innerText(), first, `${path} starts at its first step`);
    const next = page.locator('.tour-actions .button:not(.ghost)');
    // Steps whose target isn't on the page (an empty list, say) are skipped, so walk to the end.
    for (let i = 0; i < 5 && (await next.innerText()) !== 'Got it'; i++) await next.click();
    assert.equal(await next.innerText(), 'Got it', `${path} reaches its last step`);
    await next.click();
    assert.equal(await page.locator('.tour').count(), 0, `${path} tour finished`);
  }
  console.log('PASS: the tour steps, comes back twice after closing, and stops on Don’t show again.');
} finally {
  await browser.close();
}
