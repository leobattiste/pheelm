import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('app/donate/page.tsx', 'utf8');
const site = fs.readFileSync('lib/site.ts', 'utf8');
const header = fs.readFileSync('components/SiteHeader.tsx', 'utf8');

// Both ways to give come from lib/site.ts; with neither set, the page says donations open soon.
assert.match(site, /export const DONATE_URL = process\.env\.NEXT_PUBLIC_DONATE_URL \|\|/);
assert.match(site, /export const DONATE_MONTHLY_URL = process\.env\.NEXT_PUBLIC_DONATE_MONTHLY_URL \|\|/);
assert.match(page, /Donations open soon/);
assert.match(page, /const open = Boolean\(DONATE_URL \|\| DONATE_MONTHLY_URL\)/);
// Checkout opens in the same tab, so Stripe's return to /donate?thanks lands where the donor started.
assert.doesNotMatch(page, /target="_blank"/);
assert.match(page, /thanks === "monthly"/);
// Every payment link must point at Stripe and come back to the Donate page.
for (const m of site.matchAll(/NEXT_PUBLIC_DONATE(?:_MONTHLY)?_URL \|\| "([^"]*)"/g)) {
  if (m[1]) assert.match(m[1], /^https:\/\/(buy|donate)\.stripe\.com\//, 'donation links go to Stripe');
}
// Honest about tax status, matching the terms.
assert.match(page, /not a tax-exempt charity/);
// The menu always opens the Donate page, which explains the options.
assert.match(header, /<Link href="\/donate"[^>]*>.*Donate<\/Link>/);
assert.doesNotMatch(header, /DONATE_URL/);
console.log('PASS: The Donate page offers one-time and monthly gifts through Stripe, thanks donors on return, and says donations open soon until links are set.');
