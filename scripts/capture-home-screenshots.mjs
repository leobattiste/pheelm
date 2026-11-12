// Captures the live Films, Directors, Watchlists and Leo's profile pages at a square-friendly
// desktop size (1200px wide), in dark and light, for the home page; they're cropped square after. Run by .github/workflows/home-screenshots.yml.
//
// Signing in: with SUPABASE_SERVICE_ROLE_KEY (a GitHub Actions secret), the script makes a
// one-time sign-in link for the owner's account (no email is sent), exchanges it for a session
// the way the site does, hands that session to the browser as the site's own cookies, and signs
// the session out again at the end. The owner's email is looked up, never printed.
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'https://www.pheelm.com';
const OUT = process.env.OUT_DIR || 'screenshots';
const SUPABASE_URL = 'https://mvhwfmlairwrngdttzjh.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_rDCrA8n8lr6NLBCWDeY1FA_ZAc4s-UY';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGES = { films: '/films', directors: '/directors', watchlists: '/watchlists', members: '/@leo' };
mkdirSync(OUT, { recursive: true });


// Signed in as the owner when the service key is available; signed out otherwise.
let jar = [];
let ssr = null;
if (SERVICE_KEY) {
  // A session for the owner, as the site's auth cookies.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: owner, error: ownerError } = await admin.from('profiles').select('id').eq('is_owner', true).limit(1).maybeSingle();
  if (ownerError || !owner) throw new Error('Could not find the owner account.');
  const { data: user, error: userError } = await admin.auth.admin.getUserById(owner.id);
  if (userError || !user?.user?.email) throw new Error('Could not read the owner account.');
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.user.email });
  if (linkError || !link?.properties?.hashed_token) throw new Error('Could not create a sign-in link.');
  ssr = createServerClient(SUPABASE_URL, PUBLISHABLE_KEY, { cookies: {
    getAll: () => jar.map(({ name, value }) => ({ name, value })),
    setAll: (cookies) => { for (const c of cookies) { jar = jar.filter((j) => j.name !== c.name); if (c.value) jar.push(c); } },
  } });
  const { error: verifyError } = await ssr.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (verifyError || !jar.length) throw new Error('Could not sign in for the screenshots.');

}

const browser = await chromium.launch();
try {
  for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2, colorScheme: theme });
    // A returning member: no welcome message or install banner, and the chosen theme.
    await context.addInitScript((t) => {
      try {
        localStorage.setItem('pheelm:welcomed', '1');
        localStorage.setItem('pheelm:install-dismissed', String(Date.now()));
        localStorage.setItem('theme', t);
      } catch {}
    }, theme);
    const page = await context.newPage();
    // Cookies go on the host the site ends up on (pheelm.com may redirect to www).
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const origin = new URL(page.url()).origin;
    if (jar.length) await context.addCookies(jar.map((c) => ({ name: c.name, value: c.value, url: origin, sameSite: 'Lax', secure: true })));
    for (const [name, path] of Object.entries(PAGES)) {
      const res = await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 60000 });
      if (!res?.ok()) throw new Error(`${path} returned ${res?.status()}`);
      if (jar.length && await page.locator('header >> text=Sign in').count()) throw new Error('The browser is not signed in.');
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
} finally {
  await browser.close();
  // End the session made for the screenshots.
  if (ssr) await ssr.auth.signOut({ scope: 'local' }).catch(() => {});
}
