// Toasts: one line of text is a pill; wrapped text gets the rounded corners of cards and modals.
// Signed out, the menu bar's profile tab opens sign-in and the menu offers only Sign in.
// Run against a started server: BASE_URL=http://localhost:3000 node tests/toast-shape-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/films`, { waitUntil: 'networkidle' });
  const show = (message) => page.evaluate((m) => window.dispatchEvent(new CustomEvent('pheelm:toast', { detail: { message: m, kind: 'success', duration: 20000 } })), message);
  const radius = async () => {
    await page.waitForTimeout(400);
    return page.locator('.toast').last().evaluate(el => ({ radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), height: el.getBoundingClientRect().height, multi: el.classList.contains('is-multiline') }));
  };
  await show('Saved.');
  const one = await radius();
  assert(!one.multi && one.radius > 100, `one line is a pill ${JSON.stringify(one)}`);
  await show('This watchlist was saved, and everyone who follows it will see the films you added in their feed tomorrow.');
  const many = await radius();
  assert(many.multi && many.radius === 18, `wrapped text gets card corners ${JSON.stringify(many)}`);

  // Signed out: profile icon in the bar, and only Sign in in the menu.
  const tab = page.locator('.tab-bar .tab.visitor-only');
  assert.equal(await tab.getAttribute('aria-label'), 'Sign in');
  assert.equal(await page.locator('.tab-bar .tab:visible').count(), 5, 'five tabs');
  await page.locator('.tab-bar button.tab').click();
  await page.waitForSelector('.menu-sheet[open]');
  const items = await page.locator('.menu-sheet .menu-account').innerText();
  assert(items.includes('Sign in') && !/early access/i.test(items), `menu offers only Sign in: ${items}`);
  console.log('PASS: one-line toasts are pills, wrapped toasts get card corners; signed out, the menu offers only Sign in.');
} finally {
  await browser.close();
}
