// A browser request to Supabase that never answers gives up after the time limit instead of
// hanging, and a caller's own abort still works.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const bundle = await build({
  stdin: { contents: `import { fetchWithTimeout, REQUEST_TIMEOUT_MS } from './lib/supabase/client'; window.fetchWithTimeout = fetchWithTimeout; window.LIMIT = REQUEST_TIMEOUT_MS;`, resolveDir: process.cwd(), loader: 'ts' },
  define: { 'process.env.NEXT_PUBLIC_SUPABASE_URL': '""', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '""', 'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': '""', 'process.env': '{}' },
  bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.json',
});

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
try {
  const page = await browser.newPage();
  // A server that accepts the request and never answers.
  await page.route('http://stuck.test/**', () => {});
  await page.route('http://fine.test/**', (r) => r.fulfill({ body: 'ok' }));
  await page.goto('about:blank');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const limit = await page.evaluate(() => window.LIMIT);
  assert.equal(limit, 20000);

  // Normal requests are untouched.
  assert.equal(await page.evaluate(() => window.fetchWithTimeout('http://fine.test/a').then((r) => r.text())), 'ok');

  // A stuck request fails once the limit passes (the clock is sped up for the test).
  const stuck = await page.evaluate(async () => {
    const realTimeout = AbortSignal.timeout;
    AbortSignal.timeout = () => realTimeout.call(AbortSignal, 300);
    try {
      const started = Date.now();
      await window.fetchWithTimeout('http://stuck.test/b').then(() => 'answered', (e) => e.name);
      return { outcome: await window.fetchWithTimeout('http://stuck.test/c').then(() => 'answered', (e) => e.name), took: Date.now() - started };
    } finally { AbortSignal.timeout = realTimeout; }
  });
  assert.match(stuck.outcome, /TimeoutError|AbortError/, `a stuck request should time out, got ${stuck.outcome}`);
  assert.ok(stuck.took < 5000, `it should give up quickly in the test, took ${stuck.took}ms`);

  // The caller's own abort still cancels straight away.
  const aborted = await page.evaluate(() => {
    const c = new AbortController();
    const p = window.fetchWithTimeout('http://stuck.test/d', { signal: c.signal }).then(() => 'answered', (e) => e.name);
    c.abort();
    return p;
  });
  assert.equal(aborted, 'AbortError');
  console.log('PASS: browser requests give up after the time limit, normal ones are untouched, and callers can still abort.');
} finally {
  await browser.close();
}
