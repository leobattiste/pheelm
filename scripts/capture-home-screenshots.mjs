// Captures the live Films, Directors, Watchlists and Leo's profile pages at desktop size, in dark
// and light, for the home page. Run by .github/workflows/home-screenshots.yml.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'https://pheelm.com';
const OUT = process.env.OUT_DIR || 'screenshots';
const PAGES = { films: '/films', directors: '/directors', watchlists: '/watchlists', members: '/@leo' };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: theme });
  // A returning visitor: no welcome message or install banner, and the chosen theme.
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('pheelm:welcomed', '1');
      localStorage.setItem('pheelm:install-dismissed', String(Date.now()));
      localStorage.setItem('theme', t);
    } catch {}
  }, theme);
  const page = await context.newPage();
  for (const [name, path] of Object.entries(PAGES)) {
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 });
    if (!res?.ok()) throw new Error(`${path} returned ${res?.status()}`);
    // Wait for every image in view to finish loading, then let the fade-ins settle.
    await page.evaluate(async () => {
      const visible = [...document.images].filter((img) => img.getBoundingClientRect().top < innerHeight);
      await Promise.all(visible.map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 15000); })));
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
    console.log('captured', name, theme);
  }
  await context.close();
}
await browser.close();
