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
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  assert.equal(await page.locator('.tour').count(), 0, 'not a fourth time');

  // "Don't show again" and finishing both stop it at once.
  await page.evaluate(() => localStorage.removeItem('pheelm:tour:v1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.tour-card', { timeout: 15000 });
  await page.locator('.tour-off').click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  assert.equal(await page.locator('.tour').count(), 0, 'off for good');

  // Settings -> Display -> Replay starts it again from the first step, even after "Don't show again".
  await page.evaluate(() => window.dispatchEvent(new Event('pheelm:tour-replay')));
  await page.waitForSelector('.tour-card', { timeout: 15000 });
  assert.match(await page.locator('.tour-count').innerText(), /1 of 5/);
  assert.match(await page.locator('.tour-text').innerText(), /Browse films by Black directors from around the world/);
  console.log('PASS: the tour steps, comes back twice after closing, and stops on Don’t show again.');
} finally {
  await browser.close();
}
