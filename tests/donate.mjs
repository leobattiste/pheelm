import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('app/donate/page.tsx', 'utf8');
const button = fs.readFileSync('app/donate/BuyButton.tsx', 'utf8');
const site = fs.readFileSync('lib/site.ts', 'utf8');
const header = fs.readFileSync('components/SiteHeader.tsx', 'utf8');
const account = fs.readFileSync('app/account/page.tsx', 'utf8');

// The Donate page shows Stripe's Buy Button from lib/site.ts; without it, donations open soon.
assert.match(site, /DONATE_BUTTON_ID = process\.env\.NEXT_PUBLIC_DONATE_BUTTON_ID \|\| "buy_btn_[A-Za-z0-9]+"/);
assert.match(site, /"pk_live_[A-Za-z0-9]+"/, 'a publishable key (public by design)');
assert.doesNotMatch(site, /sk_live|rk_live/, 'no secret Stripe key in the code');
assert.match(page, /Donations open soon/);
assert.match(page, /<BuyButton buttonId=\{DONATE_BUTTON_ID\} publishableKey=\{STRIPE_PUBLISHABLE_KEY\} \/>/);
assert.match(button, /src="https:\/\/js\.stripe\.com\/v3\/buy-button\.js"/);
assert.match(button, /createElement\("stripe-buy-button", \{ "buy-button-id": buttonId, "publishable-key": publishableKey \}\)/);
assert.match(button, /onError=/, 'a blocked script explains itself instead of leaving a blank card');
// The security policy lets Stripe's script run.
assert.match(fs.readFileSync('next.config.ts', 'utf8'), /script-src[^`]*https:\/\/js\.stripe\.com/);
// Honest about tax status, matching the terms; a thank-you when Stripe sends donors back.
assert.match(page, /not a tax-exempt charity/);
assert.match(page, /thanks !== undefined/);
// The menu always opens the Donate page; Settings and Donate link to Stripe's portal for payment details.
assert.match(header, /<Link href="\/donate"[^>]*>.*Donate<\/Link>/);
assert.match(site, /DONATION_PORTAL_URL = process\.env\.NEXT_PUBLIC_DONATION_PORTAL_URL \|\| "https:\/\/billing\.stripe\.com\/p\/login\//);
assert.match(account, /href=\{DONATION_PORTAL_URL\}>Manage payment details</);
assert.match(page, /href=\{DONATION_PORTAL_URL\}/);
console.log('PASS: The Donate page shows Stripe’s Buy Button in a Pheelm card, and Settings links to Stripe’s portal for payment details.');
