// The loading line: tapping a link to another page draws a white line along the top edge of the
// menu bar, from left to right, and it clears once the new page is in place.
// Run against a started server: BASE_URL=http://localhost:3000 node tests/nav-progress-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/films`, { waitUntil: 'networkidle' });
  const line = page.locator('.tab-bar > .nav-progress');
  assert.equal(await line.count(), 1, 'the menu bar has a loading line');
  assert.equal(await line.evaluate(el => getComputedStyle(el).opacity), '0', 'hidden while nothing loads');
  const fit = await line.evaluate(el => {
    const l = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect(), s = getComputedStyle(el.parentElement);
    return { height: l.height, border: parseFloat(s.borderTopWidth), top: l.top - b.top, startsAfterCurve: Math.round(l.left - b.left), endsBeforeCurve: Math.round(b.right - l.right), radius: Math.round(b.height / 2) };
  });
  assert.equal(fit.height, fit.border, 'the line has the same weight as the bar border');
  assert.equal(fit.top, 0, 'and sits on its top edge');
  assert(Math.abs(fit.startsAfterCurve - fit.radius) <= 2 && Math.abs(fit.endsBeforeCurve - fit.radius) <= 2, `straight top only, end to end ${JSON.stringify(fit)}`);

  // Tapping a link to another page starts the line; the new page clears it.
  await page.evaluate(() => {
    window.__navStates = [];
    new MutationObserver(() => window.__navStates.push(document.documentElement.dataset.nav ?? '')).observe(document.documentElement, { attributes: true, attributeFilter: ['data-nav'] });
    document.querySelector('.tab-bar a[href="/directors"]').click();
  });
  await page.waitForURL(`${base}/directors`);
  await page.waitForFunction(() => !document.documentElement.dataset.nav, null, { timeout: 5000 });
  const states = await page.evaluate(() => window.__navStates);
  assert(states.includes('loading'), `a tap starts the line (${states})`);
  assert(states.includes('done'), `the new page finishes it (${states})`);

  // While loading, the line shows and grows from the left.
  await page.evaluate(() => { document.documentElement.dataset.nav = 'loading'; });
  await page.waitForTimeout(800);
  const loading = await line.evaluate(el => { const s = getComputedStyle(el); return { opacity: s.opacity, p: parseFloat(s.getPropertyValue('--nav-p')), image: s.backgroundImage }; });
  assert.equal(loading.opacity, '1', 'visible while loading');
  assert(loading.p > 0 && loading.p < 88, `filled from the left, partway (${loading.p}%)`);
  assert.match(loading.image, /transparent|rgba\(0, 0, 0, 0\)/, 'soft ends, not a hard cut');
  if (process.env.NAV_SCREENSHOT) await page.screenshot({ path: process.env.NAV_SCREENSHOT });
  await page.evaluate(() => { delete document.documentElement.dataset.nav; });

  // Same page: nothing to load, no line.
  await page.evaluate(() => document.querySelector('.tab-bar a[href="/directors"]').click());
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.nav ?? ''), '', 'no line for the page you are on');

  // The landing page has no bar: the line runs along the top of the screen.
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.nav-progress.is-top').evaluate(el => getComputedStyle(el).display), 'block', 'top line on the landing page');
  console.log('PASS: loading line appears on the menu bar from the left, clears when the page arrives, and runs along the top where there is no bar.');
} finally {
  await browser.close();
}
