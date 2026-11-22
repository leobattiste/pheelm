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

// On-page checkout: amounts are re-checked on the server, and only Stripe's form ever sees card details.
import ts from 'typescript';
import vm from 'node:vm';
const lib = fs.readFileSync('lib/donate.ts', 'utf8');
const code = ts.transpileModule(lib, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(code, { exports: mod.exports, module: mod, process: { env: {} }, require: (n) => (n === 'stripe' ? { default: class {} } : {}) });
const { donationCents, EMBEDDED_DONATIONS } = mod.exports;
assert.equal(EMBEDDED_DONATIONS, false, 'without keys the page falls back to the Stripe links');
assert.equal(donationCents('once', 1), 100);
assert.equal(donationCents('once', 0.5), null);
assert.equal(donationCents('monthly', 4), null, 'monthly gifts start at $5');
assert.equal(donationCents('monthly', 5), 500);
assert.equal(donationCents('once', 1000), 100000);
assert.equal(donationCents('once', 1001), null);
assert.equal(donationCents('once', NaN), null);
assert.match(lib, /ui_mode: "embedded_page"/);
assert.match(lib, /import "server-only"/);
const action = fs.readFileSync('app/donate/actions.ts', 'utf8');
assert.match(action, /const cents = donationCents\(kind, dollars\)/, 'the server re-checks the amount');
assert.match(action, /: "www\.pheelm\.com"/, 'donors only return to Pheelm');
assert.match(fs.readFileSync('next.config.ts', 'utf8'), /https:\/\/js\.stripe\.com/, 'the security policy allows Stripe.js');
assert.match(fs.readFileSync('app/donate/DonateForm.tsx', 'utf8'), /secret \? loadStripe/, 'Stripe.js loads only when paying');
console.log('PASS: On-page donations check amounts on the server, return only to Pheelm, and load Stripe only to pay.');
