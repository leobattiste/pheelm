// Tour polish: it waits for the visitor's first tap or scroll, tapping the highlighted menu item
// moves on, swipes and arrow keys step through, and only totals are counted (no user id).
// Run against a started server: BASE_URL=http://localhost:3000 node tests/tour-polish-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.addInitScript(() => { try { localStorage.setItem('pheelm:tour:test', '1'); } catch {} });
  const counts = [];
  await context.route('**/rest/v1/rpc/tour_count', (route) => { counts.push(route.request().postDataJSON()); route.fulfill({ status: 204, body: '' }); });
  const page = await context.newPage();
  await page.goto(`${base}/help`, { waitUntil: 'networkidle' });

  // Nothing opens by itself while the visitor is just looking (the idle fallback is much later).
  await page.waitForTimeout(3500);
  assert.equal(await page.locator('.tour').count(), 0, 'waits for the visitor');
  // The first tap starts it.
  await page.mouse.move(200, 300);
  await page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
  await page.waitForSelector('.tour-welcome', { timeout: 5000 });
  await page.locator('.tour-welcome .tour-off').click();
  await page.waitForSelector('.tour-count');
  assert.match(await page.locator('.tour-count').innerText(), /1 of 5/);
  assert.match(await page.locator('.tour [role=status]').textContent(), /Step 1 of 5/, 'announced for screen readers');

  // Arrow keys step through; Tab stays inside the card.
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.tour-count').innerText(), /2 of 5/);
  await page.keyboard.press('ArrowLeft');
  assert.match(await page.locator('.tour-count').innerText(), /1 of 5/);
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest('.tour-card')), true, 'focus stays in the card');

  // Tapping the highlighted menu item goes to the next step and does not leave the page.
  const url = page.url();
  await page.locator('.tab-bar [aria-label^="Films"]').first().click();
  assert.match(await page.locator('.tour-count').innerText(), /2 of 5/);
  assert.equal(page.url(), url, 'still on the same page');

  // A swipe left goes forward, a swipe right goes back.
  const swipe = async (dx) => page.locator('.tour-card').evaluate((el, d) => {
    const mk = (type, x) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 })] }));
    mk('touchstart', 200); mk('touchend', 200 + d);
  }, dx);
  await swipe(-120);
  assert.match(await page.locator('.tour-count').innerText(), /3 of 5/);
  await swipe(120);
  assert.match(await page.locator('.tour-count').innerText(), /2 of 5/);

  // Only totals leave the browser: a tour, a step number and what happened. (Without a database
  // configured, as in the site's own checks, nothing is sent at all.)
  for (const c of counts) assert.deepEqual(Object.keys(c).sort(), ['p_event', 'p_step', 'p_tour']);
  if (counts.length) {
    assert.ok(counts.some((c) => c.p_event === 'started'));
    assert.ok(counts.some((c) => c.p_event === 'step' && c.p_step === 1));
  }
  console.log('tour polish ok');
} finally {
  await browser.close();
}
